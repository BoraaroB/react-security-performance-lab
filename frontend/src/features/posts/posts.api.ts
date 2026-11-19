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

// 204 on success. 403 if the user is neither the author nor an admin: the server decides, not the hidden button.
export async function deletePost(postId: string): Promise<void> {
  // encodeURIComponent: an id with "/" or "?" must stay one path segment, not change the URL.
  const path = `${POSTS_PATH}/${encodeURIComponent(postId)}`;
  await authHttp.request(path, { method: 'DELETE' });
}
