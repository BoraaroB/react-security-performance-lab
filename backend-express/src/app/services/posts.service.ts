import { AppError } from '../../lib/errors/index.js';
import type { Post, PostsRepository } from '../repositories/posts.repository.js';
import type { PublicUser, UsersRepository } from '../repositories/users.repository.js';
import type { CreatePostInput } from '../schemas/posts.schemas.js';

/** What clients see about a post. */
export interface PublicPost {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  // Only id and name: every logged-in user sees every post, so the author's email is not sent.
  // null if the author's account no longer exists.
  author: { id: string; name: string } | null;
}

export interface PostsDeps {
  posts: PostsRepository;
  users: Pick<UsersRepository, 'findById'>;
}

export function createPostsService({ posts, users }: PostsDeps) {
  function toPublicPost(post: Post): PublicPost {
    const user = users.findById(post.authorId);
    const author = user ? { id: user.id, name: user.name } : null;

    return {
      id: post.id,
      title: post.title,
      content: post.content,
      createdAt: post.createdAt,
      author,
    };
  }

  return {
    listPosts(): PublicPost[] {
      const allPosts = posts.findAll();
      return allPosts.map(toPublicPost);
    },

    createPost(author: PublicUser, input: CreatePostInput): PublicPost {
      // The author is the logged-in user, never a value from the request body.
      const post = posts.create({ authorId: author.id, title: input.title, content: input.content });
      return toPublicPost(post);
    },

    // The ownership check lives here, on the server. A UI may hide the delete button, but that is only UX.
    deletePost(user: PublicUser, postId: string): void {
      const post = posts.findById(postId);
      if (!post) throw new AppError(404, 'NOT_FOUND', 'Post not found');

      // Compare with the logged-in user's ID, not with anything from the request: the ID in the URL is
      // under the caller's control, so it alone must never decide access (IDOR).
      const isAuthor = post.authorId === user.id;
      const isAdmin = user.role === 'admin';
      // 403, not 404: every logged-in user already sees every post, so "it exists" is no secret.
      if (!isAuthor && !isAdmin) throw new AppError(403, 'FORBIDDEN', 'You do not have permission to do this');

      posts.delete(post.id);
    },
  };
}

export type PostsService = ReturnType<typeof createPostsService>;
