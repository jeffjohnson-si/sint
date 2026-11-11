import DodoPayments from 'dodopayments';
import { SUBSCRIPTION_PLANS } from '../config/constants.js';
import { config } from '../config/env.js';

/**
 * Dodo Payments.
 *
 * Two things are worth knowing before reading:
 *
 * 1. A SINT plan is a Dodo **product**, not something we create at runtime. The
 *    product ids come from the dashboard and the amount charged is whatever the
 *    product says, so the SBD prices in constants.js are display only.
 * 2. Checkout uses **checkout sessions** (POST /checkouts). Dodo deprecated
 *    creating subscriptions directly.
 */

let client = null;

export function dodoConfigured() {
  return Boolean(config.dodo.apiKey);
}

/** True when both plan products are configured, so checkout can actually run. */
export function dodoProductsConfigured() {
  return Boolean(config.dodo.productMonthly && config.dodo.productYearly);
}

function getClient() {
  if (!dodoConfigured()) return null;
  client ??= new DodoPayments({
    bearerToken: config.dodo.apiKey,
    webhookKey: config.dodo.webhookKey || null,
    environment: config.dodo.mode === 'live' ? 'live_mode' : 'test_mode',
  });
  return client;
}

/** Maps a SINT plan key to the Dodo product that sells it. */
export function productIdFor(planKey) {
  const plan = SUBSCRIPTION_PLANS[planKey];
  if (!plan) throw new Error(`Unknown plan: ${planKey}`);
  return planKey === 'yearly' ? config.dodo.productYearly : config.dodo.productMonthly;
}

/** Maps a Dodo product id back to a SINT plan key, or null if it is unknown. */
export function planKeyForProduct(productId) {
  if (!productId) return null;
  if (productId === config.dodo.productYearly) return 'yearly';
  if (productId === config.dodo.productMonthly) return 'monthly';
  return null;
}

/**
 * Creates a hosted checkout session and returns the URL to send the customer to.
 * `userId` travels in metadata so the webhook knows which account paid, even
 * before any subscription id has been stored on our side.
 */
export async function createCheckoutSession({ userId, planKey }) {
  const productId = productIdFor(planKey);
  if (!productId) {
    throw new Error(
      `No Dodo product configured for the ${planKey} plan. Set DODO_PRODUCT_${planKey.toUpperCase()} in the API .env.`,
    );
  }

  const session = await getClient().checkoutSessions.create({
    product_cart: [{ product_id: productId, quantity: 1 }],
    return_url: `${config.appBaseUrl}/plans?checkout=returned`,
    metadata: { userId: userId.toString(), planKey },
  });

  return { url: session.checkout_url ?? null, sessionId: session.session_id };
}

export async function getSubscription(subscriptionId) {
  return getClient().subscriptions.retrieve(subscriptionId);
}

export async function cancelSubscription(subscriptionId) {
  // Dodo keeps the subscription active until the paid period ends.
  return getClient().subscriptions.update(subscriptionId, {
    cancel_at_next_billing_date: true,
  });
}

/**
 * Verifies the signature and returns the parsed event. Throws when the
 * signature is missing or wrong, so callers must catch.
 */
export function unwrapWebhook(rawBody, headers) {
  return getClient().webhooks.unwrap(rawBody, {
    headers,
    key: config.dodo.webhookKey || undefined,
  });
}
