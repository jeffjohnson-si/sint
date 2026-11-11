import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

/**
 * Sends an email. Uses the SMTP settings from the environment.
 * In development without SMTP settings, the message is logged to the console instead.
 */
let _transporter;

async function transporter() {
  if (_transporter) return _transporter;

  if (!config.smtp?.host) {
    // Development: no SMTP configured — use a test account that logs everything.
    _transporter = nodemailer.createTransport({
      jsonTransport: true,
    });
    return _transporter;
  }

  _transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port ?? 587,
    secure: config.smtp.secure ?? false,
    auth: config.smtp.user
      ? { user: config.smtp.user, pass: config.smtp.pass }
      : undefined,
  });

  return _transporter;
}

/**
 * @param {{ to: string, subject: string, html: string }} opts
 */
export async function sendEmail({ to, subject, html }) {
  const t = await transporter();
  const result = await t.sendMail({
    from: config.smtp?.from ?? 'SINT <noreply@sint.sb>',
    to,
    subject,
    html,
  });

  if (result.message) {
    // jsonTransport: the full MIME message is in result.message — useful in dev.
    console.info('[email]', subject, '→', to);
    if (!config.isProd) console.info('[email] body:', result.message);
  }

  return result;
}

/** Sends a password-reset code to the user's email. */
export async function sendResetCode({ toEmail, code }) {
  return sendEmail({
    to: toEmail,
    subject: 'Your SINT password reset code',
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="font-size: 24px; font-weight: 800; margin-bottom: 8px;">Reset your password</h2>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">
          We received a request to reset the password for your SINT account.
          Use the code below to continue:
        </p>
        <div style="background: #f3f4f6; border-radius: 10px; padding: 20px 28px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: 900; letter-spacing: 0.15em; color: #111827;">${code}</span>
        </div>
        <p style="color: #6b7280; font-size: 13px;">
          This code expires in 10 minutes. If you did not request a password reset, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}

/** Sends the 6-digit code that confirms a new account's email address. */
export async function sendVerificationCode({ toEmail, code }) {
  return sendEmail({
    to: toEmail,
    subject: 'Confirm your SINT account',
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="font-size: 24px; font-weight: 800; margin-bottom: 8px;">Welcome to SINT</h2>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.6;">
          Solomon Islands Net Trade — every business in one place.
          Enter this code to confirm your email address and finish setting up your account:
        </p>
        <div style="background: #f3f4f6; border-radius: 10px; padding: 20px 28px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: 900; letter-spacing: 0.15em; color: #111827;">${code}</span>
        </div>
        <p style="color: #6b7280; font-size: 13px;">
          This code expires in 10 minutes. If you did not create a SINT account, you can ignore this email.
        </p>
      </div>
    `,
  });
}
