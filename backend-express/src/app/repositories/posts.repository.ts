import { randomUUID } from 'node:crypto';
import type { PostRecord, Store } from '../store.js';

/** A post as the rest of the app sees it (nothing is encrypted, so it is the same as the stored row). */
export type Post = PostRecord;

export interface NewPost {
  authorId: string;
  title: string;
  content: string;
}

/** Data access for posts. Only this file touches `store.posts`. */
export function createPostsRepository(store: Store) {
  return {
    create(input: NewPost): Post {
      const post: PostRecord = {
        id: randomUUID(), // random, so IDs do not reveal how many posts exist
        authorId: input.authorId,
        title: input.title,
        content: input.content,
        createdAt: new Date().toISOString(),
      };
      store.posts.set(post.id, post);

      // A copy: a caller changing it must not change the stored row.
      return { ...post };
    },

    /** Every post, newest first. */
    findAll(): Post[] {
      const oldestFirst = [...store.posts.values()]; // a Map keeps insertion order
      const newestFirst = oldestFirst.reverse();
      return newestFirst.map((post) => ({ ...post }));
    },
  };
}

export type PostsRepository = ReturnType<typeof createPostsRepository>;
