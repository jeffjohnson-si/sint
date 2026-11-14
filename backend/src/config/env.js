import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProd = nodeEnv === 'production';

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const config = {
  nodeEnv,
  isProd,
  port: Number(process.env.PORT ?? 4000),
  mongoUri: required('MONGO_URI', 'mongodb://127.0.0.1:27017/sint'),
  jwtSecret: required('JWT_SECRET', isProd ? '' : 'dev-only-change-me'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET', isProd ? '' : 'dev-only-change-me-too'),
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL ?? '2h',
  refreshTokenTtl: process.env.REFRESH_TOKEN_TTL ?? '30d',
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  uploadDir: path.resolve(rootDir, process.env.UPLOAD_DIR ?? 'uploads'),
  maxImageBytes: Number(process.env.MAX_IMAGE_MB ?? 5) * 1024 * 1024,
  maxVideoBytes: Number(process.env.MAX_VIDEO_MB ?? 50) * 1024 * 1024,
  maxImagesPerPost: 10,
  publicBaseUrl: (process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 4000}`)
    .replace(/\/$/, ''),

  /** Where the payment provider sends the customer back after checkout. */
  appBaseUrl: (process.env.APP_BASE_URL ?? 'http://localhost:8123').replace(/\/$/, ''),

  /**
   * Dodo Payments. Leave the API key blank to disable card payments; plans,
   * trials and the paywall keep working without it.
   *
   * 1. dashboard.dodopayments.com > Products: create two subscription products
   *    (monthly and yearly), priced in USD. Copy their ids.
   * 2. Developer > API keys: create a key and set DODO_API_KEY.
   * 3. Developer > Webhooks: point it at /api/subscription/webhook and copy the
   *    signing secret into DODO_WEBHOOK_KEY. Subscribe to the subscription.*
   *    and payment.* events.
   *
   * Plans are products here, so the SBD prices in constants.js are only used
   * for display — the amount charged comes from the Dodo product.
   */
  dodo: {
    /** 'test' or 'live' */
    mode: process.env.DODO_MODE ?? 'test',
    apiKey: process.env.DODO_API_KEY ?? '',
    webhookKey: process.env.DODO_WEBHOOK_KEY ?? '',
    productMonthly: process.env.DODO_PRODUCT_MONTHLY ?? '',
    productYearly: process.env.DODO_PRODUCT_YEARLY ?? '',
  },

  /**
   * Whether a lapsed plan blocks publishing. Off means every publisher can post
   * regardless of subscription state — the v1 arrangement while card payments
   * are not live yet. Set BILLING_ENFORCED=true when payments go on sale.
   */
  billingEnforced: (process.env.BILLING_ENFORCED ?? 'true').toLowerCase() !== 'false',

  /** Failed sign-in attempts allowed per 15 minutes, per email and IP. */
  loginMaxAttempts: Number(process.env.LOGIN_MAX_ATTEMPTS ?? 5),



  /** SMTP for email delivery (e.g. SendGrid, Mailgun, Gmail SMTP).
   *  Leave host blank to use nodemailer's test-transport in dev (logs to console). */
  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.SMTP_FROM ?? 'SINT <noreply@sint.sb>',
  },
};

if (isProd) {
  if (config.jwtSecret.startsWith('dev-only')) {
    throw new Error('JWT_SECRET must be changed before running in production');
  }
  if (config.jwtRefreshSecret.startsWith('dev-only')) {
    throw new Error('JWT_REFRESH_SECRET must be changed before running in production');
  }
  if (config.corsOrigins.length === 0) {
    throw new Error('CORS_ORIGINS must be set in production');
  }
  // Sign up is gated on an emailed code, so without SMTP nobody can register.
  if (!config.smtp.host) {
    throw new Error(
      'SMTP_HOST must be set in production: sign up sends a verification code by email, so without it nobody can finish signing up',
    );
  }
}
