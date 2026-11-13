/**
 * Express adapter: `authorize(...roles)` lets a request through only if the current user has one of the roles.
 * Otherwise it answers 403 (via the app's error handler).
 */
import type { Request, RequestHandler } from 'express';
import { AppError } from '../errors/index.js';
import { hasRole, RbacConfigError } from './core.js';

export interface AuthorizeOptions<Role extends string> {
  /**
   * Reads the current user's role from the request, e.g. `(req) => req.user?.role`. Read it from data loaded from
   * the database on this request, not from a token claim: a role in a token is a snapshot from login, so a demoted
   * admin would keep admin rights until the token expires. `undefined` means no logged-in user.
   */
  getRole: (req: Request) => Role | undefined;
}

/** Created once in the app with a way to read the role; returns `authorize(...roles)` for the routes. */
export function createAuthorize<Role extends string>({ getRole }: AuthorizeOptions<Role>) {
  return function authorize(...allowedRoles: Role[]): RequestHandler {
    // Fail at startup: an empty list would block every request, and that bug should not wait for the first request.
    if (allowedRoles.length === 0) throw new RbacConfigError('authorize() needs at least one role');

    return (req, _res, next) => {
      const role = getRole(req);
      // No user at all means the authentication middleware did not run before this: a wiring mistake, not a client
      // error. Fail closed and loud (500) instead of answering 403, which would hide the bug.
      if (role === undefined) return next(new Error('authorize() must run after the middleware that loads the user'));

      // 403, not 401: the user IS logged in, logging in again would not help. The message does not name the
      // required role, so it tells a curious user nothing about how the app's permissions are set up.
      if (!hasRole(role, allowedRoles)) return next(new AppError(403, 'FORBIDDEN', 'You do not have permission to do this'));
      next();
    };
  };
}
