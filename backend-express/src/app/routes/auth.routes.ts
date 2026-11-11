import { Router } from 'express';
import { rateLimit } from '../../lib/rate-limit/index.js';
import { validate } from '../../lib/validation/index.js';
import { createAuthController } from '../controllers/auth.controller.js';
import { logger } from '../logger.js';
import { loginSchema } from '../schemas/auth.schemas.js';
import type { AuthService } from '../services/auth.service.js';

export function createAuthRouter(auth: AuthService) {
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

  router.post('/login', loginLimiter, validate({ body: loginSchema }), controller.login);

  return router;
}
