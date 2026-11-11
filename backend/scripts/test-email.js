/**
 * Sends a real verification email through the configured SMTP provider.
 *
 *   npm run test-email -- you@example.com
 *
 * Run this after filling in the SMTP_* values in backend/.env. It uses the same
 * code path as sign up, so a success here means sign-up email works; a failure
 * prints the provider's response (wrong key, unverified sender, blocked port).
 */
import { config } from '../src/config/env.js';
import { sendVerificationCode } from '../src/utils/email.js';

const to = process.argv[2];

if (!to) {
  console.error('Usage: npm run test-email -- you@example.com');
  process.exit(1);
}

if (!config.smtp.host || !config.smtp.user || !config.smtp.pass) {
  console.error(
    'SMTP is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS in backend/.env first.',
  );
  process.exit(1);
}

console.log(`Provider : ${config.smtp.host}:${config.smtp.port} (secure=${config.smtp.secure})`);
console.log(`Login    : ${config.smtp.user}`);
console.log(`From     : ${config.smtp.from}`);
console.log(`To       : ${to}`);
console.log('Sending…');

try {
  const result = await sendVerificationCode({ toEmail: to, code: '123456' });
  console.log('\nAccepted by the mail server.');
  console.log('messageId:', result.messageId ?? '(none returned)');
  console.log(`Now check ${to} (and the spam folder) for a message from ${config.smtp.from}.`);
  console.log('Using code 123456 only proves delivery — it is not a real signup code.');
} catch (error) {
  console.error('\nSend failed:', error.message);
  if (error.responseCode) {
    console.error('SMTP response:', error.responseCode, String(error.response ?? '').trim());
  }
  console.error('\nCommon causes:');
  console.error('  - 535 / "authentication failed": wrong SMTP login or key');
  console.error('  - 550 / "sender not verified": the From address is not verified in the provider');
  console.error('  - ETIMEDOUT / ECONNREFUSED: wrong host or port, or the network blocks port 587');
  process.exit(1);
}
