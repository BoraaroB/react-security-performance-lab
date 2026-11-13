import { Router } from 'express';
import { validate } from '../../lib/validation/index.js';
import { createMobileAuthController } from '../controllers/mobile-auth.controller.js';
import { loginSchema, registerSchema } from '../schemas/auth.schemas.js';
import { refreshTokenBodySchema } from '../schemas/mobile-auth.schemas.js';
import type { AuthService } from '../services/auth.service.js';
import type { AuthLimiters } from './auth.routes.js';

export interface MobileAuthRouterDeps {
  auth: AuthService;
  /** The SAME limiter instances as the web router, so mobile is not a second door with its own 10 password guesses. */
  limiters: AuthLimiters;
}

/**
 * Auth for native apps (iOS, Android). The current user comes from the web route `GET /api/auth/me` with a Bearer
 * token: it reads no cookie, so it needs no mobile twin.
 */
export function createMobileAuthRouter({ auth, limiters }: MobileAuthRouterDeps) {
  const router = Router();
  const controller = createMobileAuthController(auth);

  // These responses carry a refresh token in the body: no cache anywhere may keep a copy.
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  router.post('/login', limiters.login, validate({ body: loginSchema }), controller.login);
  router.post('/register', limiters.register, validate({ body: registerSchema }), controller.register);
  router.post('/refresh', validate({ body: refreshTokenBodySchema }), controller.refresh);
  router.post('/logout', validate({ body: refreshTokenBodySchema }), controller.logout);

  return router;
}
