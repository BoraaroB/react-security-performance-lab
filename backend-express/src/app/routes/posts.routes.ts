import { Router, type RequestHandler } from 'express';
import { validate } from '../../lib/validation/index.js';
import { createPostsController } from '../controllers/posts.controller.js';
import { createPostSchema } from '../schemas/posts.schemas.js';
import type { PostsService } from '../services/posts.service.js';

export interface PostsRouterDeps {
  posts: PostsService;
  /** Middleware that lets only a logged-in user through and sets `req.user` (built once in `app.ts`). */
  requireUser: RequestHandler[];
}

export function createPostsRouter({ posts, requireUser }: PostsRouterDeps) {
  const router = Router();
  const controller = createPostsController(posts);

  // Responses for logged-in users only: no copy in a shared proxy or CDN cache, or in the browser cache on a
  // shared computer. First, so the 401 responses get it too.
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  // For the whole router, like the admin router: a posts route added later is protected without anyone remembering to.
  router.use(requireUser);

  // The CSRF check for POST already ran in app.ts, before this router. Global rate limit only.
  router.get('/', controller.list);
  router.post('/', validate({ body: createPostSchema }), controller.create);

  return router;
}
