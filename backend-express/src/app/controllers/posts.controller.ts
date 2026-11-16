import type { RequestHandler } from 'express';
import type { CreatePostInput, PostIdParams } from '../schemas/posts.schemas.js';
import type { PostsService } from '../services/posts.service.js';

export function createPostsController(posts: PostsService) {
  const list: RequestHandler = (_req, res) => {
    const allPosts = posts.listPosts();
    res.json({ posts: allPosts });
  };

  const create: RequestHandler<unknown, unknown, CreatePostInput, unknown> = (req, res) => {
    // `requireUser` always sets `req.user` on this router. If it is missing, the wiring is broken:
    // answer 500 and save nothing, instead of saving a post without an author.
    if (!req.user) throw new Error('Posts routes must run after requireUser');

    const post = posts.createPost(req.user, req.body);
    res.status(201).json({ post });
  };

  const remove: RequestHandler<PostIdParams> = (req, res) => {
    // Same as `create`: without `req.user` the wiring is broken, so answer 500 and delete nothing.
    if (!req.user) throw new Error('Posts routes must run after requireUser');

    posts.deletePost(req.user, req.params.id);
    res.status(204).end();
  };

  return { list, create, remove };
}
