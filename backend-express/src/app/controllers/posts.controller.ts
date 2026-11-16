import type { Request, RequestHandler } from 'express';
import type { PublicUser } from '../repositories/users.repository.js';
import type { CreatePostInput } from '../schemas/posts.schemas.js';
import type { PostsService } from '../services/posts.service.js';

// `requireUser` runs before every posts route. If it is missing (a wiring mistake), fail closed with a 500 instead of
// creating a post without an author.
function currentUser(req: Request<unknown, unknown, unknown, unknown>): PublicUser {
  if (!req.user) throw new Error('Posts routes must run after requireUser');
  return req.user;
}

export function createPostsController(posts: PostsService) {
  const list: RequestHandler = (_req, res) => {
    const allPosts = posts.listPosts();
    res.json({ posts: allPosts });
  };

  const create: RequestHandler<unknown, unknown, CreatePostInput, unknown> = (req, res) => {
    const author = currentUser(req);
    const post = posts.createPost(author, req.body);
    // 201 Created: a new resource (the post) exists now.
    res.status(201).json({ post });
  };

  return { list, create };
}
