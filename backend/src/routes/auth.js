import crypto from 'node:crypto';
import express from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { ACCOUNT_TYPES, PUBLISHER_TYPES, TRIAL_DAYS } from '../config/constants.js';
import { config } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { VerificationCode } from '../models/VerificationCode.js';
import { badRequest, conflict, notFound, unauthorized } from '../utils/httpError.js';
import { normaliseCategory, normaliseProfileLinks } from '../utils/query.js';
import { issueTokens, signPasswordResetToken, verifyAccessToken, verifyRefreshToken } from '../utils/tokens.js';
import { sendResetCode, sendVerificationCode } from '../utils/email.js';

export const authRouter = express.Router();

const WINDOW_MS = 15 * 60 * 1000;

/**
 * Sign in: 5 failed attempts per 15 minutes, keyed by the email **and** the IP.
 * Successful sign-ins are not counted, so a shared connection (an office, a
 * cybercafe) cannot lock a whole building out. The 429 carries the wait time in
 * the message and in `Retry-After`.
 */
const loginLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: Number(process.env.LOGIN_MAX_ATTEMPTS ?? 5),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) =>
    `${ipKeyGenerator(req.ip)}:${String(req.body?.email ?? '').toLowerCase().trim()}`,
  handler: (req, res, next, options) => {
    const minutes = Math.ceil(options.windowMs / 60000);
    res.setHeader('Retry-After', String(Math.ceil(options.windowMs / 1000)));
    res.status(429).json({
      message: `Too many sign-in attempts. Try again in ${minutes} minutes.`,
    });
  },
});

/** Everything else under /auth: generous, but still bounded. */
const authLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: config.isProd ? 30 : 1000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many attempts, please try again later' },
});

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_TTL_MS = 10 * 60 * 1000;
const RESET_PURPOSE = 'password_reset';
const VERIFY_PURPOSE = 'email_verify';

function hashCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

/**
 * Creates a fresh 6-digit code for [purpose] and returns the plain value so the
 * caller can email it. A new request retires the previous live code.
 */
async function issueCode({ user, purpose, destination }) {
  await VerificationCode.updateMany({ user: user._id, purpose, used: false }, { used: true });

  const code = String(Math.floor(100000 + Math.random() * 900000));
  await VerificationCode.create({
    user: user._id,
    channel: 'email',
    purpose,
    codeHash: hashCode(code),
    destination,
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });

  return code;
}

/** Throws unless [code] matches a live code for this destination and purpose. */
async function consumeCode({ destination, code, purpose }) {
  const record = await VerificationCode.findOne({
    destination,
    channel: 'email',
    purpose,
    used: false,
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    // codeHash is select:false. Without this the comparison below is against
    // undefined and every code is rejected.
    .select('+codeHash');

  if (!record || hashCode(code) !== record.codeHash) {
    throw badRequest('Code is invalid or has expired');
  }

  record.used = true;
  await record.save();
  return record;
}

function authPayload(user) {
  return { user: user.toPublicJson({ includeEmail: true }), ...issueTokens(user) };
}

authRouter.post('/signup', authLimiter, async (req, res) => {
  const {
    fullName,
    email,
    password,
    accountType = 'user',
    acceptedTerms,
    category,
    location,
    phone,
    address,
    contactEmail,
    bio,
    links,
  } = req.body ?? {};

  if (!fullName || String(fullName).trim().length < 2) {
    throw badRequest('Please enter your full name');
  }
  if (!EMAIL_PATTERN.test(String(email ?? ''))) {
    throw badRequest('Please enter a valid email address');
  }
  if (String(password ?? '').length < 6) {
    throw badRequest('Password must be at least 6 characters');
  }
  if (!ACCOUNT_TYPES.includes(accountType)) {
    throw badRequest('Please choose a valid account type');
  }
  if (acceptedTerms === false) {
    throw badRequest('You must accept the Terms & Conditions');
  }

  // The directory, search and the category rail are useless without these two,
  // so publishers give them up front rather than editing their profile later.
  const isPublisher = PUBLISHER_TYPES.includes(accountType);
  if (isPublisher) {
    if (!String(category ?? '').trim()) throw badRequest('Please choose your business category');
    if (!String(location ?? '').trim()) throw badRequest('Please enter where you are based');
  }

  const normalisedEmail = String(email).toLowerCase().trim();
  if (await User.exists({ email: normalisedEmail })) {
    throw conflict('That email is already registered');
  }

  const user = new User({
    fullName: String(fullName).trim(),
    email: normalisedEmail,
    accountType,
    contactEmail: normalisedEmail,
    // Confirmed by the 6-digit code sent just below.
    emailVerified: false,
  });

  if (isPublisher) {
    user.category = normaliseCategory(category);
    user.location = String(location).trim();
    if (bio !== undefined) user.bio = String(bio).trim();
    if (phone !== undefined) user.phone = String(phone).trim();
    if (address !== undefined) user.address = String(address).trim();
    if (String(contactEmail ?? '').trim()) user.contactEmail = String(contactEmail).trim();
    if (links !== undefined) user.links = normaliseProfileLinks(links);

    // Businesses start on a free trial so they can post before paying.
    user.subscription.status = 'trialing';
    user.subscription.trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  }

  await user.setPassword(String(password));
  await user.save();

  const code = await issueCode({ user, purpose: VERIFY_PURPOSE, destination: normalisedEmail });
  // A mail failure must not lose the account: the code can be resent.
  sendVerificationCode({ toEmail: normalisedEmail, code }).catch((error) =>
    console.error('Could not send verification email', error),
  );

  const payload = authPayload(user);
  // Development has no SMTP, so the code is echoed for testing.
  if (!config.isProd) payload.devCode = code;

  res.status(201).json(payload);
});

authRouter.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body ?? {};
  const user = await User.findOne({ email: String(email ?? '').toLowerCase().trim() }).select(
    '+passwordHash',
  );

  if (!user || !(await user.verifyPassword(String(password ?? '')))) {
    throw unauthorized('Incorrect email or password');
  }

  res.json(authPayload(user));
});

authRouter.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body ?? {};
  if (!refreshToken) throw badRequest('refreshToken is required');

  let payload;
  try {
    payload = verifyRefreshToken(String(refreshToken));
  } catch {
    throw unauthorized('Session expired, please sign in again');
  }

  const user = await User.findById(payload.sub);
  if (!user) throw unauthorized('Session expired, please sign in again');

  res.json(authPayload(user));
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user.toPublicJson({ includeEmail: true }) });
});

/**
 * Demo accounts the development shortcut can sign in as. Both are created by
 * `npm run seed`; the shortcut exists so the flow can be exercised without
 * typing credentials on every reload.
 */
const DEV_ACCOUNTS = {
  business: 'demo@sint.sb',
  customer: 'peter@sint.sb',
};

/**
 * POST /auth/dev-login
 * Development only. Returns 404 as soon as NODE_ENV=production, so this cannot
 * be used to walk into a live deployment.
 */
authRouter.post('/dev-login', authLimiter, async (req, res) => {
  if (config.isProd) throw notFound('Not found');

  const account = String(req.body?.account ?? 'business');
  const email = DEV_ACCOUNTS[account];
  if (!email) throw badRequest(`Unknown demo account: ${account}`);

  const user = await User.findOne({ email });
  if (!user) throw notFound(`${email} does not exist yet — run "npm run seed" in backend/`);

  res.json(authPayload(user));
});

/**
 * POST /auth/verify-email
 * Confirms the address a new account signed up with. Returns a full session, so
 * the client does not have to sign in again after confirming.
 */
authRouter.post('/verify-email', authLimiter, async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const code = String(req.body?.code ?? '').trim();
  if (!EMAIL_PATTERN.test(email)) throw badRequest('Please enter a valid email address');
  if (!/^\d{6}$/.test(code)) throw badRequest('Enter the 6-digit code');

  const user = await User.findOne({ email });
  if (!user) throw badRequest('Code is invalid or has expired');

  if (!user.emailVerified) {
    await consumeCode({ destination: email, code, purpose: VERIFY_PURPOSE });
    user.emailVerified = true;
    user.emailVerifiedAt = new Date();
    await user.save();
  }

  res.json(authPayload(user));
});

/**
 * POST /auth/resend-verification
 * Same answer whether or not the account exists, so it cannot be used to
 * discover which addresses are registered.
 */
authRouter.post('/resend-verification', authLimiter, async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) throw badRequest('Please enter a valid email address');

  const response = { message: 'If that account still needs confirming, a new code has been sent' };
  const user = await User.findOne({ email });
  if (!user || user.emailVerified) {
    res.json(response);
    return;
  }

  const code = await issueCode({ user, purpose: VERIFY_PURPOSE, destination: email });
  sendVerificationCode({ toEmail: email, code }).catch((error) =>
    console.error('Could not send verification email', error),
  );

  if (!config.isProd) response.devCode = code;
  res.json(response);
});

/**
 * POST /auth/forgot-password
 * Accepts an email address. Generates a 6-digit code and sends it via email.
 * The same response is returned whether or not the account exists, so accounts
 * cannot be enumerated.
 */
authRouter.post('/forgot-password', authLimiter, async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  if (!email) throw badRequest('Please enter your email address');
  if (!EMAIL_PATTERN.test(email)) throw badRequest('Please enter a valid email address');

  const user = await User.findOne({ email });

  // Always return the same message so the endpoint cannot be used to enumerate accounts.
  if (!user) {
    res.json({ message: 'If that account exists, a reset code has been sent' });
    return;
  }

  // Invalidate any existing unused codes for this user.
  const code = await issueCode({ user, purpose: RESET_PURPOSE, destination: email });
  await sendResetCode({ toEmail: email, code });

  // In dev without SMTP, echo the code so the developer can test without a real account.
  const response = { message: 'If that account exists, a reset code has been sent' };
  if (!config.isProd) response.devCode = code;

  res.json(response);
});

/**
 * POST /auth/verify-code
 * Checks the 6-digit code and returns a short-lived reset token if valid.
 * The reset token is only valid for the password-change step and expires in 10 minutes.
 */
authRouter.post('/verify-code', authLimiter, async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const code = String(req.body?.code ?? '').trim();
  if (!email) throw badRequest('Email is required');
  if (!/^\d{6}$/.test(code)) throw badRequest('Enter the 6-digit code');

  const record = await consumeCode({ destination: email, code, purpose: RESET_PURPOSE });

  // A scoped, short-lived token: it can set a new password and nothing else.
  const user = await User.findById(record.user);
  if (!user) throw unauthorized('Account not found');

  res.json({ accessToken: signPasswordResetToken(user) });
});

/**
 * POST /auth/reset-password
 * Protected by the scoped token returned from /verify-code. A normal access
 * token is refused here, and a reset token is refused everywhere else.
 */
authRouter.post('/reset-password', authLimiter, async (req, res) => {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw unauthorized('Not authenticated');

  let payload;
  try {
    payload = verifyAccessToken(token, { scope: 'password_reset' });
  } catch {
    throw unauthorized('That reset session has expired. Request a new code.');
  }

  if (String(req.body?.password ?? '').length < 6) {
    throw badRequest('Password must be at least 6 characters');
  }

  const user = await User.findById(payload.sub).select('+passwordHash');
  if (!user) throw unauthorized('Account not found');

  await user.setPassword(String(req.body.password));
  await user.save();

  res.json(authPayload(user));
});
