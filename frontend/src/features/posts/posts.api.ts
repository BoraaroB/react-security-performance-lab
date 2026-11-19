import { authHttp } from '@/features/auth/auth.http';
import type { CreatePostInput } from './posts.schemas';

// Same shape as the API's PublicPost (no author email: every logged-in user sees every post).
export type Post = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  // null when the author's account no longer exists.
  author: { id: string; name: string } | null;
};

export type PostsResponse = {
  posts: Post[];
};

export const POSTS_PATH = '/api/posts';

// authHttp adds the access token and the CSRF header, and refreshes an expired token once.
export async function createPost(input: CreatePostInput): Promise<Post> {
  const response = await authHttp.request<{ post: Post }>(POSTS_PATH, { method: 'POST', body: input });
  return response.post;
}
