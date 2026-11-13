import { Router, type RequestHandler } from 'express';
import { createAdminController } from '../controllers/admin.controller.js';
import type { AdminService } from '../services/admin.service.js';

export interface AdminRouterDeps {
  admin: AdminService;
  /** Lets only a logged-in admin through (built once in `app.ts`: token → user → role). */
  requireAdmin: RequestHandler[];
}

export function createAdminRouter({ admin, requireAdmin }: AdminRouterDeps) {
  const router = Router();
  const controller = createAdminController(admin);

  // Admin responses hold other people's personal data: no copy in the browser, proxy or CDN cache.
  // First, so the 401/403 responses get it too.
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  // For the WHOLE router, not per route: a route added here later is protected without anyone remembering to.
  // It also runs before the 404, so a non-admin cannot probe which admin paths exist (every path → 401/403).
  router.use(requireAdmin);

  router.get('/users', controller.listUsers);

  return router;
}
