import express from 'express';
import { SUBSCRIPTION_PLANS, TRIAL_DAYS } from '../config/constants.js';
import { config } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { activatePlan } from '../utils/billing.js';
import {
  cancelSubscription as dodoCancel,
  createCheckoutSession,
  dodoConfigured,
  dodoProductsConfigured,
  getSubscription as dodoGet,
  planKeyForProduct,
  unwrapWebhook,
} from '../utils/dodo.js';
import { badRequest, forbidden } from '../utils/httpError.js';

export const subscriptionRouter = express.Router();

const plans = Object.values(SUBSCRIPTION_PLANS).map((plan) => ({
  id: plan.id,
  label: plan.label,
  priceText: plan.priceText,
  note: plan.note,
  amount: plan.amount,
  currency: plan.currency.toUpperCase(),
  interval: plan.interval,
  verified: plan.verified,
  benefits: plan.benefits,
}));

function stateOf(user) {
  return user.toPublicJson({ includeEmail: true }).subscription;
}

function assertPublisher(user) {
  if (!user.isPublisher) throw forbidden('Only business accounts need a subscription');
}

/** Both an API key and both product ids are needed before checkout can run. */
function billingReady() {
  return dodoConfigured() && dodoProductsConfigured();
}

/** GET /api/subscription - plans on offer plus the caller's current state. */
subscriptionRouter.get('/', requireAuth, async (req, res) => {
  res.json({
    plans,
    trialDays: TRIAL_DAYS,
    billingEnabled: billingReady(),
    // False during v1: the client should not tell anyone publishing is paused.
    billingEnforced: config.billingEnforced,
    pendingPayment: null,
    subscription: stateOf(req.user),
  });
});

/**
 * POST /api/subscription/checkout
 * Creates a Dodo checkout session and returns the hosted URL. The customer pays
 * there; the webhook is what actually activates the plan.
 */
subscriptionRouter.post('/checkout', requireAuth, async (req, res) => {
  assertPublisher(req.user);

  const planKey = String(req.body?.plan ?? '');
  if (!SUBSCRIPTION_PLANS[planKey]) throw badRequest('Choose the monthly or yearly plan');

  if (!dodoConfigured()) {
    throw badRequest(
      'Card payments are not configured yet. Add DODO_API_KEY to the API .env.',
    );
  }
  if (!dodoProductsConfigured()) {
    throw badRequest(
      'Card payments are missing a product id. Set DODO_PRODUCT_MONTHLY and DODO_PRODUCT_YEARLY.',
    );
  }

  const { url, sessionId } = await createCheckoutSession({
    userId: req.user._id,
    planKey,
  });
  if (!url) throw badRequest('Dodo did not return a checkout URL');

  // Remember the plan so the webhook and the plans screen agree even before the
  // subscription id is known.
  req.user.subscription.plan = planKey;
  await req.user.save();

  res.json({ url, sessionId });
});

/** POST /api/subscription/cancel - stops the renewal at the end of the period. */
subscriptionRouter.post('/cancel', requireAuth, async (req, res) => {
  assertPublisher(req.user);

  const subscriptionId = req.user.subscription?.dodoSubscriptionId;
  if (!subscriptionId) throw badRequest('There is no paid subscription to cancel');

  await dodoCancel(subscriptionId);
  req.user.subscription.cancelAtPeriodEnd = true;
  await req.user.save();

  res.json({ subscription: stateOf(req.user) });
});

/**
 * POST /api/subscription/refresh
 * Pulls the latest state from Dodo. Called when the customer returns from
 * checkout, before the webhook may have been delivered.
 */
subscriptionRouter.post('/refresh', requireAuth, async (req, res) => {
  assertPublisher(req.user);

  const subscriptionId = req.user.subscription?.dodoSubscriptionId;
  if (!subscriptionId || !dodoConfigured()) {
    res.json({ subscription: stateOf(req.user) });
    return;
  }

  try {
    const subscription = await dodoGet(subscriptionId);
    await applySubscription(req.user, subscription);
  } catch (error) {
    console.error('Could not refresh the subscription:', error.message);
  }

  res.json({ subscription: stateOf(req.user) });
});

function mapDodoStatus(status) {
  switch (status) {
    case 'active':
      return 'active';
    case 'on_hold':
    case 'past_due':
    case 'paused':
      return 'past_due';
    case 'cancelled':
    case 'expired':
    case 'failed':
      return 'canceled';
    default:
      // 'pending' and anything new: leave the account as it is.
      return null;
  }
}

/**
 * Writes a Dodo subscription onto the user. `planKey` is resolved from the
 * product id when possible, otherwise the plan recorded at checkout is kept.
 */
async function applySubscription(user, subscription) {
  const status = mapDodoStatus(subscription.status);
  const planKey =
    planKeyForProduct(subscription.product_id) || user.subscription?.plan || 'monthly';
  const periodEnd = subscription.next_billing_date
    ? new Date(subscription.next_billing_date)
    : null;

  user.subscription.dodoSubscriptionId = subscription.subscription_id;
  user.subscription.plan = planKey;
  user.subscription.cancelAtPeriodEnd = Boolean(subscription.cancel_at_next_billing_date);
  if (periodEnd) user.subscription.currentPeriodEnd = periodEnd;

  if (status === 'active') {
    user.subscription.status = 'active';
    if (!periodEnd) {
      // Dodo did not report a renewal date; without one the account would read
      // as lapsed immediately, so grant one interval.
      activatePlan(user, planKey);
    }
  } else if (status === 'past_due') {
    user.subscription.status = 'past_due';
  } else if (status === 'canceled') {
    // A cancellation still runs to the end of the paid period. Keeping the
    // status active lets the model flip it once currentPeriodEnd passes.
    const stillPaid = periodEnd && periodEnd > new Date();
    if (!stillPaid && subscription.status !== 'cancelled') {
      user.subscription.status = 'canceled';
    } else if (subscription.status === 'cancelled') {
      user.subscription.cancelAtPeriodEnd = true;
      if (!stillPaid) user.subscription.status = 'canceled';
    }
  }

  await user.save();
  return user;
}

/** Resolves the account a webhook belongs to: metadata first, email second. */
async function findUserForEvent(subscription) {
  const fromMetadata = subscription?.metadata?.userId;
  if (fromMetadata) {
    const user = await User.findById(fromMetadata);
    if (user) return user;
  }

  const email = subscription?.customer?.email;
  if (email) return User.findOne({ email: String(email).toLowerCase().trim() });

  return null;
}

/**
 * Dodo webhook. Mounted in app.js before the JSON body parser so the raw body
 * is available for signature verification.
 *
 * Handled events:
 *   subscription.active / renewed / updated / plan_changed / unpaused → activate
 *   subscription.cancelled                                          → cancel at period end
 *   subscription.expired / failed                                   → canceled
 *   subscription.on_hold / past_due / paused                        → past due
 */
export async function dodoWebhookHandler(req, res) {
  if (!dodoConfigured()) {
    res.status(503).json({ error: 'Payments are not configured' });
    return;
  }

  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';

  let event;
  try {
    event = unwrapWebhook(rawBody, req.headers);
  } catch {
    res.status(400).json({ error: 'Invalid webhook signature' });
    return;
  }

  try {
    const subscription = event.data ?? {};

    switch (event.type) {
      case 'subscription.active':
      case 'subscription.renewed':
      case 'subscription.updated':
      case 'subscription.plan_changed':
      case 'subscription.unpaused': {
        const user = await findUserForEvent(subscription);
        if (user) await applySubscription(user, subscription);
        break;
      }

      case 'subscription.cancelled': {
        const user = await findUserForEvent(subscription);
        if (user) {
          user.subscription.cancelAtPeriodEnd = true;
          if (subscription.next_billing_date) {
            user.subscription.currentPeriodEnd = new Date(subscription.next_billing_date);
          }
          await user.save();
        }
        break;
      }

      case 'subscription.expired':
      case 'subscription.failed': {
        const user = await findUserForEvent(subscription);
        if (user) {
          user.subscription.status = 'canceled';
          await user.save();
        }
        break;
      }

      case 'subscription.on_hold':
      case 'subscription.past_due':
      case 'subscription.paused': {
        const user = await findUserForEvent(subscription);
        if (user) {
          user.subscription.status = 'past_due';
          await user.save();
        }
        break;
      }

      default:
        break;
    }
  } catch (error) {
    console.error('Payment webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
    return;
  }

  res.json({ received: true });
}
