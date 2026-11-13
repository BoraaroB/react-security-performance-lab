import { Router, type RequestHandler } from 'express';
import { rateLimit } from '../../lib/rate-limit/index.js';
import { validate } from '../../lib/validation/index.js';
import { createAuthController } from '../controllers/auth.controller.js';
import { logger } from '../logger.js';
import { loginSchema, registerSchema } from '../schemas/auth.schemas.js';
import type { AuthService } from '../services/auth.service.js';

/**
 * The strict login and register limiters. Created once in app.ts and shared by the web and the mobile auth routers,
 * so both count against ONE budget per IP: separate limiters would give a password guesser 10 tries per router.
 */
export function createAuthLimiters() {
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

  return { login: loginLimiter, register: registerLimiter };
}

export type AuthLimiters = ReturnType<typeof createAuthLimiters>;

export interface AuthRouterDeps {
  auth: AuthService;
  /** Middleware that lets only a logged-in user through and sets `req.user` (built once in `app.ts`). */
  requireUser: RequestHandler[];
  limiters: AuthLimiters;
  /** `GET /csrf` handler: sets the CSRF cookie and returns the token (from `createCsrfProtection` in `app.ts`). */
  issueCsrfToken: RequestHandler;
}

export function createAuthRouter({ auth, requireUser, limiters, issueCsrfToken }: AuthRouterDeps) {
  const router = Router();
  const controller = createAuthController(auth);

  // Auth responses carry tokens and personal data: the browser, proxies and CDNs must not keep a copy (e.g. on a
  // shared computer, where the next person could see them in the cache). Set first, so error responses get it too.
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  // The frontend calls it before its first POST (also before login: login CSRF would log the victim into an
  // attacker's account). Global limit only. The CSRF check itself runs in app.ts, before this router.
  router.get('/csrf', issueCsrfToken);
  router.post('/login', limiters.login, validate({ body: loginSchema }), controller.login);
  router.post('/register', limiters.register, validate({ body: registerSchema }), controller.register);
  // No strict limiter: a refresh token has 256 random bits, so guessing one is hopeless, and the frontend refreshes
  // often (every 15 minutes per tab). The global limit still applies.
  router.post('/refresh', controller.refresh);
  // No `requireUser`: the access token may already have expired, and logout must still end the session. The refresh
  // cookie says which session to end. Global limit only.
  router.post('/logout', controller.logout);
  // No strict limiter: the frontend calls /me on every page load, and only the global limit applies.
  router.get('/me', requireUser, controller.me);

  return router;
}
