import { Router, type RequestHandler } from 'express';
import { validate } from '../../lib/validation/index.js';
import { createPostsController } from '../controllers/posts.controller.js';
import { createPostSchema, postIdParamsSchema } from '../schemas/posts.schemas.js';
import type { PostsService } from '../services/posts.service.js';

export interface PostsRouterDeps {
  posts: PostsService;
  /** Lets only a logged-in user through and sets `req.user` (built once in `app.ts`). */
  requireUser: RequestHandler[];
}

export function createPostsRouter({ posts, requireUser }: PostsRouterDeps) {
  const router = Router();
  const controller = createPostsController(posts);

  // Data for logged-in users only: no copy in the browser or proxy cache. First, so 401 responses get it too.
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  // For the whole router: a posts route added later is protected without anyone remembering to.
  router.use(requireUser);

  router.get('/', controller.list);
  // The CSRF check (POST and DELETE) already ran in app.ts, before this router.
  router.post('/', validate({ body: createPostSchema }), controller.create);
  router.delete('/:id', validate({ params: postIdParamsSchema }), controller.remove);

  return router;
}
