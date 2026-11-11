import type { RequestHandler } from 'express';
import { AppError } from '../../lib/errors/index.js';
import { toPublicUser, type PublicUser, type UsersRepository } from '../repositories/users.repository.js';

// Adds `req.user` to Express's Request type for the whole app.
declare global {
  namespace Express {
    interface Request {
      /**
       * Set by `loadCurrentUser`. Undefined on routes without it. The public shape on purpose: there is no
       * `passwordHash` on the request, so a handler cannot leak it by sending or logging `req.user`.
       */
      user?: PublicUser;
    }
  }
}

/**
 * Runs after `authenticate`: loads the user the token belongs to (by `sub`) and puts it on `req.user`.
 * The token carries only the user ID, so the role and the account itself are checked against the store on every
 * request: a deleted user is rejected at once, and a changed role counts at once, without waiting for the token to expire.
 */
export function loadCurrentUser(users: Pick<UsersRepository, 'findById'>): RequestHandler {
  return (req, res, next) => {
    const userId = req.auth?.sub;
    // A wiring mistake (no `authenticate` before this), not a client error: fail closed with a 500.
    if (!userId) return next(new Error('loadCurrentUser must run after authenticate'));

    const user = users.findById(userId);
    if (!user) {
      // A valid signature, but the account is gone. Same answer as a missing token: the client must log in again.
      res.set('WWW-Authenticate', 'Bearer');
      return next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
    }

    req.user = toPublicUser(user);
    next();
  };
}
