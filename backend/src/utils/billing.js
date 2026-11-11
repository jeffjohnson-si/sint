import { SUBSCRIPTION_PLANS } from '../config/constants.js';

/** Adds one plan interval to [from], keeping the day of the month where possible. */
export function addInterval(from, interval) {
  const next = new Date(from);
  if (interval === 'year') next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1);
  return next;
}

/**
 * Activates [plan] on [user] and returns the new period end. Time already paid
 * for is never thrown away: renewing early extends from the existing end date
 * rather than from today.
 */
export function activatePlan(user, planId, now = new Date()) {
  const plan = SUBSCRIPTION_PLANS[planId];
  if (!plan) throw new Error(`Unknown plan: ${planId}`);

  const current = user.subscription?.currentPeriodEnd;
  const startFrom = current && new Date(current) > now ? new Date(current) : now;
  const periodEnd = addInterval(startFrom, plan.interval);

  user.subscription.status = 'active';
  user.subscription.plan = plan.id;
  user.subscription.currentPeriodEnd = periodEnd;
  user.subscription.cancelAtPeriodEnd = false;

  return periodEnd;
}
