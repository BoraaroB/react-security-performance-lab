import { Router, type RequestHandler } from 'express';
import { rateLimit } from '../../lib/rate-limit/index.js';
import { validate } from '../../lib/validation/index.js';
import { createAuthController } from '../controllers/auth.controller.js';
import { logger } from '../logger.js';
import { loginSchema, registerSchema } from '../schemas/auth.schemas.js';
import type { AuthService } from '../services/auth.service.js';

export interface AuthRouterDeps {
  auth: AuthService;
  /** Middleware that lets only a logged-in user through and sets `req.user` (built once in `app.ts`). */
  requireUser: RequestHandler[];
}

export function createAuthRouter({ auth, requireUser }: AuthRouterDeps) {
  const router = Router();
  const controller = createAuthController(auth);

  // Auth responses carry tokens and personal data: the browser, proxies and CDNs must not keep a copy (e.g. on a
  // shared computer, where the next person could see them in the cache). Set first, so error responses get it too.
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  // Much stricter than the global limit: 10 tries per 15 minutes per IP makes password guessing slow, and caps how
  // much bcrypt CPU one client can burn. Only on login itself; other auth routes (e.g. /me) must not share this limit.
  const loginLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: 10,
    message: 'Too many login attempts, please try again later.',
    logger,
  });

  // Its own counter, not the login one: someone who just created an account must still be able to log in. Stricter
  // than login (5 per hour): real people register once, while bots create accounts in bulk or probe which emails
  // are taken (a 409 tells them). Per IP, so people behind one shared IP (office, school, mobile carrier) share these
  // 5: an accepted trade-off. Not `skipFailedRequests`: that would also skip the 409s and allow mass email probing.
  const registerLimiter = rateLimit({
    windowMs: 60 * 60_000,
    limit: 5,
    message: 'Too many sign-up attempts, please try again later.',
    logger,
  });

  router.post('/login', loginLimiter, validate({ body: loginSchema }), controller.login);
  router.post('/register', registerLimiter, validate({ body: registerSchema }), controller.register);
  // No strict limiter: the frontend calls /me on every page load, and only the global limit applies.
  router.get('/me', requireUser, controller.me);

  return router;
}
