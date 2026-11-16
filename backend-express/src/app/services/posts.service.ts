import type { Post, PostsRepository } from '../repositories/posts.repository.js';
import type { PublicUser, UsersRepository } from '../repositories/users.repository.js';
import type { CreatePostInput } from '../schemas/posts.schemas.js';

/**
 * What clients see about a post. The author is only `id` + `name`: every logged-in user reads every post, so the
 * author's email must not be in it (send only what the page needs: "excessive data exposure", OWASP API Top 10).
 * `author.id` lets the frontend show a delete button on the user's own posts (step 12c); the server still checks.
 * `author` is null if the account no longer exists.
 */
export interface PublicPost {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  author: { id: string; name: string } | null;
}

export interface PostsDeps {
  posts: PostsRepository;
  users: Pick<UsersRepository, 'findById'>;
}

/** Business logic for posts. Knows nothing about HTTP; the router makes sure a user is logged in. */
export function createPostsService({ posts, users }: PostsDeps) {
  function toPublicPost(post: Post): PublicPost {
    const { id, title, content, createdAt } = post;
    const author = users.findById(post.authorId);
    const publicAuthor = author ? { id: author.id, name: author.name } : null;
    return { id, title, content, createdAt, author: publicAuthor };
  }

  return {
    listPosts(): PublicPost[] {
      const allPosts = posts.findAll();
      return allPosts.map(toPublicPost);
    },

    /** The author is the logged-in user (`req.user`), never a value from the request body. */
    createPost(author: PublicUser, input: CreatePostInput): PublicPost {
      const post = posts.create({ authorId: author.id, title: input.title, content: input.content });
      return toPublicPost(post);
    },
  };
}

export type PostsService = ReturnType<typeof createPostsService>;
