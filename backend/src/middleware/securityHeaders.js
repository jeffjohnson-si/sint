import { config } from '../config/env.js';

/**
 * Headers that stop a browser being tricked into treating API data as a page,
 * framing it, or caching someone else's private data.
 *
 * Authentication itself is unchanged: a request proves who it is with a signed
 * bearer token, and no header — `X-User-Id`, `X-Forwarded-User`, cookies — can
 * stand in for one.
 */
export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

  if (config.isProd) {
    // Only meaningful over HTTPS, which is where production runs.
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  if (req.path.startsWith('/api')) {
    // Feeds, messages and profiles are private data; no shared cache may keep them.
    res.setHeader('Cache-Control', 'no-store');
  }

  next();
}
