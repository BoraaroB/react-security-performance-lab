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
  };
}

export type PostsService = ReturnType<typeof createPostsService>;
