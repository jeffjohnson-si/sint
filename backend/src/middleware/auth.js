import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { PUBLISHER_TYPES } from '../config/constants.js';
import { config } from '../config/env.js';
import { forbidden, paymentRequired, unauthorized } from '../utils/httpError.js';
import { verifyAccessToken } from '../utils/tokens.js';

function extractToken(req) {
  const header = req.headers.authorization ?? '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

async function resolveUser(req) {
  const token = extractToken(req);
  if (!token) return null;
  try {
    const payload = verifyAccessToken(token);
    return await User.findById(payload.sub);
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) return null;
    throw error;
  }
}

/** Rejects the request unless a valid access token is present. */
export async function requireAuth(req, res, next) {
  try {
    const user = await resolveUser(req);
    if (!user) throw unauthorized('Session expired, please sign in again');
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

/** Attaches req.user when a token is present, but never rejects. */
export async function optionalAuth(req, res, next) {
  try {
    req.user = (await resolveUser(req)) ?? null;
    next();
  } catch (error) {
    next(error);
  }
}

/** Only business, company and freelancer accounts may publish. */
export function requirePublisher(req, res, next) {
  if (!req.user || !PUBLISHER_TYPES.includes(req.user.accountType)) {
    next(forbidden('Only business, company and self-employed accounts can publish posts'));
    return;
  }
  next();
}

/**
 * Publishing needs a live trial or a paid plan — unless billing is not being
 * enforced (BILLING_ENFORCED=false), which is how v1 runs while card payments
 * are not on sale yet. Existing posts stay visible either way.
 */
export function requireActiveSubscription(req, res, next) {
  if (!config.billingEnforced || req.user?.canPublish()) {
    next();
    return;
  }
  next(
    paymentRequired('Your subscription has ended. Renew it to keep posting.', {
      code: 'subscription_required',
    }),
  );
}
