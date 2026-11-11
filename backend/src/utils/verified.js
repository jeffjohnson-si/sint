import { PUBLISHER_TYPES, SUBSCRIPTION_PLANS } from '../config/constants.js';

/**
 * The verified badge is a yearly plan perk. Written as a plain function rather
 * than a model method so it also works on the partial author documents that
 * posts, comments and conversations populate.
 */
export function isVerifiedBusiness(user) {
  if (!user || !PUBLISHER_TYPES.includes(user.accountType)) return false;

  const { status, plan, currentPeriodEnd } = user.subscription ?? {};
  if (status !== 'active' || !SUBSCRIPTION_PLANS[plan]?.verified) return false;
  return Boolean(currentPeriodEnd) && new Date(currentPeriodEnd).getTime() > Date.now();
}
