import { useState } from 'react';
import { Card } from '@/components/ui';
import { NewPostForm } from './NewPostForm';
import type { Post } from './posts.api';

type PostFeedProps = {
  // The list from the first GET. Later changes are kept in local state, so a new post appears at once,
  // without loading the whole list again.
  initialPosts: Post[];
};

export function PostFeed({ initialPosts }: PostFeedProps) {
  const [posts, setPosts] = useState(initialPosts);

  function handleCreated(post: Post) {
    // Newest first, the same order as the API.
    setPosts((current) => [post, ...current]);
  }

  return (
    <div className="space-y-6">
      <Card>
        <NewPostForm onCreated={handleCreated} />
      </Card>
      {posts.length === 0 && <p className="text-gray-700">No posts yet. Write the first one.</p>}
      <ul className="space-y-4">
        {posts.map((post) => (
          <li key={post.id}>
            <Card className="space-y-2">
              {/* Title, name and content are JSX text: React escapes them, so "<script>" in a post is shown, never run. */}
              <h2 className="font-semibold break-words text-gray-900">{post.title}</h2>
              <p className="text-sm text-gray-500">
                {post.author?.name ?? 'Deleted user'} · {new Date(post.createdAt).toLocaleString()}
              </p>
              {/* pre-wrap keeps the author's line breaks without turning them into HTML. */}
              <p className="whitespace-pre-wrap break-words text-gray-700">{post.content}</p>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
