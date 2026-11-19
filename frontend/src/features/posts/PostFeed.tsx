import { startTransition, useOptimistic, useState } from 'react';
import { toast } from 'sonner';
import { Button, Card } from '@/components/ui';
import { useAuth } from '@/features/auth/auth.context';
import { ApiError } from '@/lib/http';
import { NewPostForm } from './NewPostForm';
import { deletePost, type Post } from './posts.api';

type PostFeedProps = {
  // The list from the first GET. Later changes are kept in local state, so a new post appears at once,
  // without loading the whole list again.
  initialPosts: Post[];
};

export function PostFeed({ initialPosts }: PostFeedProps) {
  const { user } = useAuth();
  const [posts, setPosts] = useState(initialPosts);
  // `posts` minus the deletes still in progress. When the transitions end (React 19 waits for ALL pending async
  // ones together), React shows `posts` again: after a failed delete the post comes back with no code to undo it.
  const [visiblePosts, hidePost] = useOptimistic(posts, (current: Post[], deletedId: string) =>
    current.filter((post) => post.id !== deletedId),
  );

  function handleCreated(post: Post) {
    // Newest first, the same order as the API.
    setPosts((current) => [post, ...current]);
  }

  function handleDelete(postId: string) {
    startTransition(async () => {
      // Gone from the screen at once, before the server answers.
      hidePost(postId);
      try {
        await deletePost(postId);
        toast.success('Post deleted');
      } catch (error) {
        // 404: someone else (e.g. an admin) deleted it first, so it is gone either way.
        const isAlreadyDeleted = error instanceof ApiError && error.code === 'NOT_FOUND';
        // 403: e.g. the admin role was taken away meanwhile; "try again" would never help.
        const isForbidden = error instanceof ApiError && error.code === 'FORBIDDEN';
        if (isForbidden) {
          toast.error('You are not allowed to delete this post.');
          return;
        }
        if (!isAlreadyDeleted) {
          toast.error('Could not delete the post. Please try again.');
          return;
        }
      }
      // After an `await`, React needs startTransition again to keep this update inside the same transition.
      startTransition(() => {
        setPosts((current) => current.filter((post) => post.id !== postId));
      });
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <NewPostForm onCreated={handleCreated} />
      </Card>
      {visiblePosts.length === 0 && <p className="text-gray-700">No posts yet. Write the first one.</p>}
      <ul className="space-y-4">
        {visiblePosts.map((post) => {
          // Only hides the button (UX). The API checks author or admin on every DELETE.
          const canDelete = user !== null && (post.author?.id === user.id || user.role === 'admin');
          return (
            <li key={post.id}>
              <Card className="space-y-2">
                <div className="flex items-start justify-between gap-4">
                  {/* Title, name and content are JSX text: React escapes them, so "<script>" is shown, never run. */}
                  <h2 className="font-semibold break-words text-gray-900">{post.title}</h2>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      // Screen readers hear which post, not just "Delete" ten times.
                      aria-label={`Delete "${post.title}"`}
                      onClick={() => handleDelete(post.id)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  {post.author?.name ?? 'Deleted user'} · {new Date(post.createdAt).toLocaleString()}
                </p>
                {/* pre-wrap keeps the author's line breaks without turning them into HTML. */}
                <p className="whitespace-pre-wrap break-words text-gray-700">{post.content}</p>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
