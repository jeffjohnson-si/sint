/**
 * Pre-deploy environment check.
 *
 * Run this on the server before starting the API in production:
 *
 *   npm run check-env
 *
 * It reads .env directly instead of importing src/config/env.js, because that
 * module throws on bad production settings — this script should tell you what
 * is wrong, not crash on the first problem it finds.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const failures = [];
const warnings = [];
const passes = [];

const value = (name) => String(process.env[name] ?? '').trim();
const fail = (label, detail) => failures.push({ label, detail });
const warn = (label, detail) => warnings.push({ label, detail });
const pass = (label, detail) => passes.push({ label, detail });

const isProd = value('NODE_ENV') === 'production';
const looksLocal = (text) => /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(text ?? '');

/** mongodb+srv://user:pass@host/db -> mongodb+srv://***@host/db */
function maskUri(uri) {
  return uri.replace(/\/\/([^@/]+)@/, '//***@');
}

// --------------------------------------------------------------- environment

if (isProd) pass('NODE_ENV', 'production');
else fail('NODE_ENV', `is "${value('NODE_ENV') || 'unset'}", expected production`);

// ----------------------------------------------------------------- database

const mongoUri = value('MONGO_URI');
if (!mongoUri) {
  fail('MONGO_URI', 'missing');
} else if (looksLocal(mongoUri)) {
  fail('MONGO_URI', `${maskUri(mongoUri)} points at this machine`);
} else if (!/^mongodb(\+srv)?:\/\//.test(mongoUri)) {
  fail('MONGO_URI', 'must start with mongodb:// or mongodb+srv://');
} else {
  pass('MONGO_URI', maskUri(mongoUri));
}

// --------------------------------------------------------------------- auth

for (const name of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
  const secret = value(name);
  if (!secret) fail(name, 'missing');
  else if (secret.startsWith('dev-only')) fail(name, 'still the development default');
  else if (secret.length < 32) fail(name, `only ${secret.length} characters, use 32 or more`);
  else pass(name, `${secret.length} characters`);
}

if (value('JWT_SECRET') && value('JWT_SECRET') === value('JWT_REFRESH_SECRET')) {
  fail('JWT secrets', 'access and refresh secrets must differ');
}

// -------------------------------------------------------------------- http

const cors = value('CORS_ORIGINS').split(',').map((origin) => origin.trim()).filter(Boolean);
if (cors.length === 0) {
  fail('CORS_ORIGINS', 'empty — the API will refuse to boot in production');
} else if (cors.some((origin) => !origin.startsWith('https://'))) {
  fail('CORS_ORIGINS', 'every origin must be https (except localhost for testing)');
} else {
  pass('CORS_ORIGINS', cors.join(', '));
}

const publicBase = value('PUBLIC_BASE_URL');
if (!publicBase) fail('PUBLIC_BASE_URL', 'missing — uploaded files would point at localhost');
else if (!publicBase.startsWith('https://')) fail('PUBLIC_BASE_URL', 'must be https');
else if (looksLocal(publicBase)) fail('PUBLIC_BASE_URL', 'still points at localhost');
else pass('PUBLIC_BASE_URL', publicBase);

const appBase = value('APP_BASE_URL');
if (!appBase) warn('APP_BASE_URL', 'missing — checkout sends customers back to http://localhost:8123');
else if (looksLocal(appBase)) warn('APP_BASE_URL', 'points at localhost');
else pass('APP_BASE_URL', appBase);

// ------------------------------------------------------------------- email

const smtpHost = value('SMTP_HOST');
const smtpUser = value('SMTP_USER');
const smtpPass = value('SMTP_PASS');
const smtpFrom = value('SMTP_FROM');

if (!smtpHost) {
  fail('SMTP_HOST', 'missing — sign up cannot send verification codes, so nobody can finish signing up');
} else if (!smtpUser) {
  fail('SMTP_USER', 'missing');
} else if (!smtpPass) {
  fail('SMTP_PASS', 'missing');
} else if (!smtpFrom) {
  fail('SMTP_FROM', 'missing — set something like "SINT <noreply@yourdomain>"');
} else {
  pass('SMTP', `${smtpHost}:${value('SMTP_PORT') || 587} as ${smtpUser}`);
}

// ------------------------------------------------------------------ uploads

const uploadDir = path.resolve(root, value('UPLOAD_DIR') || 'uploads');
try {
  fs.mkdirSync(uploadDir, { recursive: true });
  fs.accessSync(uploadDir, fs.constants.W_OK);
  pass('UPLOAD_DIR', uploadDir);
} catch {
  fail('UPLOAD_DIR', `${uploadDir} is not writable`);
}

// ------------------------------------------------------------ dodo payments

const billingEnforced = value('BILLING_ENFORCED').toLowerCase() !== 'false';

if (!billingEnforced) {
  pass('BILLING_ENFORCED', 'off — publishers are never blocked by a lapsed plan');
}

if (!value('DODO_API_KEY')) {
  warn('Dodo Payments', 'not configured — plans, trials and the paywall work, checkout is disabled');
  if (billingEnforced) {
    warn(
      'Billing enforced without payments',
      'publishers are locked out after the trial but have no way to pay — set BILLING_ENFORCED=false for v1',
    );
  }
} else {
  const mode = value('DODO_MODE') || 'test';
  if (mode !== 'live') warn('DODO_MODE', `is "${mode}" — use live to take real money`);
  else pass('Dodo Payments', 'live API key present');

  if (!value('DODO_PRODUCT_MONTHLY')) {
    warn('DODO_PRODUCT_MONTHLY', 'missing — monthly checkout will fail');
  }
  if (!value('DODO_PRODUCT_YEARLY')) {
    warn('DODO_PRODUCT_YEARLY', 'missing — yearly checkout will fail');
  }
  if (!value('DODO_WEBHOOK_KEY')) {
    warn('DODO_WEBHOOK_KEY', 'missing — subscriptions will not activate after payment');
  }
}

// ------------------------------------------------------------------- report

const line = ({ label, detail }) => `  ${label.padEnd(20)} ${detail}`;

if (passes.length) {
  console.log('OK');
  passes.forEach((entry) => console.log(line(entry)));
}

if (warnings.length) {
  console.log('\nWARNINGS');
  warnings.forEach((entry) => console.log(line(entry)));
}

if (failures.length) {
  console.log('\nFAILED');
  failures.forEach((entry) => console.log(line(entry)));
  console.log(`\n${failures.length} problem(s) to fix before deploying.`);
  process.exit(1);
}

console.log(`\nEnvironment looks ready for production${warnings.length ? ` (${warnings.length} warning(s))` : ''}.`);
