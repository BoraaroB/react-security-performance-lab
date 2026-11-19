import { ErrorState } from '@/components/feedback/ErrorState';
import { Spinner } from '@/components/ui';
import { authHttp } from '@/features/auth/auth.http';
import { PostFeed } from '@/features/posts/PostFeed';
import { POSTS_PATH, type PostsResponse } from '@/features/posts/posts.api';
import { useFetch } from '@/hooks/useFetch';

// Behind ProtectedRoute. authHttp sends the access token (posts are for logged-in users only).
export default function DashboardPage() {
  const { data, error, isLoading, reload } = useFetch<PostsResponse>(authHttp, POSTS_PATH);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
      {isLoading && <Spinner label="Loading posts" className="text-blue-600" />}
      {error !== undefined && <ErrorState error={error} onRetry={reload} title="Could not load the posts" />}
      {data && <PostFeed initialPosts={data.posts} />}
    </div>
  );
}
