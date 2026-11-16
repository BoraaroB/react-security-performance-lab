import { randomUUID } from 'node:crypto';
import type { PostRecord, Store } from '../store.js';

/** A post as the rest of the app sees it (no encrypted fields, so the same fields as the stored row). */
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
      const record: PostRecord = {
        id: randomUUID(), // not guessable or countable, so post IDs do not reveal how many posts exist
        authorId: input.authorId,
        title: input.title,
        content: input.content,
        createdAt: new Date().toISOString(),
      };
      store.posts.set(record.id, record);
      // A copy, so a caller changing the returned object cannot change the stored row by accident.
      return { ...record };
    },

    /** Every post, newest first. A Map keeps insertion order (oldest first), so the list is reversed. */
    findAll(): Post[] {
      const records = [...store.posts.values()];
      const newestFirst = records.reverse();
      return newestFirst.map((record) => ({ ...record }));
    },
  };
}

export type PostsRepository = ReturnType<typeof createPostsRepository>;
