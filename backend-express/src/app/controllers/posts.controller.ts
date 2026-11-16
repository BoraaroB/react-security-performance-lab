import type { RequestHandler } from 'express';
import { getCurrentUser } from '../middleware/current-user.middleware.js';
import type { CreatePostInput, PostIdParams } from '../schemas/posts.schemas.js';
import type { PostsService } from '../services/posts.service.js';

export function createPostsController(posts: PostsService) {
  const list: RequestHandler = (_req, res) => {
    const allPosts = posts.listPosts();
    res.json({ posts: allPosts });
  };

  const create: RequestHandler<unknown, unknown, CreatePostInput, unknown> = (req, res) => {
    const user = getCurrentUser(req);
    const post = posts.createPost(user, req.body);
    res.status(201).json({ post });
  };

  const remove: RequestHandler<PostIdParams> = (req, res) => {
    const user = getCurrentUser(req);
    posts.deletePost(user, req.params.id);
    res.status(204).end();
  };

  return { list, create, remove };
}
