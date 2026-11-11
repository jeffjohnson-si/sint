import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

export function signAccessToken(user, { scope = 'access', expiresIn = config.accessTokenTtl } = {}) {
  return jwt.sign({ sub: user._id.toString(), type: 'access', scope }, config.jwtSecret, {
    expiresIn,
  });
}

/**
 * The token handed out after checking a password-reset code. It is deliberately
 * short lived and scoped, so it cannot be used to browse the app.
 */
export function signPasswordResetToken(user) {
  return signAccessToken(user, { scope: 'password_reset', expiresIn: '15m' });
}

export function signRefreshToken(user) {
  return jwt.sign({ sub: user._id.toString(), type: 'refresh' }, config.jwtRefreshSecret, {
    expiresIn: config.refreshTokenTtl,
  });
}

export function verifyAccessToken(token, { scope = 'access' } = {}) {
  const payload = jwt.verify(token, config.jwtSecret);
  if (payload.type !== 'access') throw new jwt.JsonWebTokenError('Wrong token type');
  // Tokens issued before scopes existed have no claim and are treated as normal.
  if ((payload.scope ?? 'access') !== scope) throw new jwt.JsonWebTokenError('Wrong token scope');
  return payload;
}

export function verifyRefreshToken(token) {
  const payload = jwt.verify(token, config.jwtRefreshSecret);
  if (payload.type !== 'refresh') throw new jwt.JsonWebTokenError('Wrong token type');
  return payload;
}

export function issueTokens(user) {
  return {
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user),
  };
}
