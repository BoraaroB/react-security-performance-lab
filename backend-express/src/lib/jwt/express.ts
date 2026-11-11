/**
 * Express adapter: `authenticate(tokens)` lets a request through only with a valid `Authorization: Bearer <token>`
 * header and puts the token's claims on `req.auth`. Otherwise it answers 401 (via the app's error handler).
 */
import type { RequestHandler } from 'express';
import { AppError } from '../errors/index.js';
import { InvalidTokenError, type AccessTokenClaims, type AccessTokenService } from './core.js';

// Adds `req.auth` to Express's Request type for the whole app.
declare global {
  namespace Express {
    interface Request {
      /** Set by `authenticate`. Undefined on routes without it. */
      auth?: AccessTokenClaims;
    }
  }
}

export function authenticate(tokens: Pick<AccessTokenService, 'verify'>): RequestHandler {
  return (req, res, next) => {
    const reject = (code: string, message: string) => {
      // RFC 6750: a 401 names the auth scheme the client should use.
      res.set('WWW-Authenticate', 'Bearer');
      next(new AppError(401, code, message));
    };

    // Only the header, never a cookie: the browser attaches cookies to cross-site requests on its own, but this header
    // must be added by our own JavaScript, so a forged cross-site form cannot send the token.
    const match = /^Bearer ([\w.-]+)$/i.exec(req.headers.authorization ?? '');
    if (!match?.[1]) return reject('UNAUTHORIZED', 'Authentication required');

    try {
      req.auth = tokens.verify(match[1]);
    } catch (error) {
      if (!(error instanceof InvalidTokenError)) return next(error);
      // TOKEN_EXPIRED: the frontend refreshes and retries. Anything else: plain UNAUTHORIZED, no reason given.
      return reject(error.code === 'TOKEN_EXPIRED' ? 'TOKEN_EXPIRED' : 'UNAUTHORIZED', error.message);
    }
    next();
  };
}
