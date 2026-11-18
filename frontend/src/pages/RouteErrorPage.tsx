import { Link, useRouteError } from 'react-router';
import { Button } from '@/components/ui';
import { PATHS } from '@/router/paths';

// What browsers (Chrome, Firefox, Safari) and Vite's CSS preload say when a page's JS or CSS file cannot be
// downloaded: the user is offline, or a new deploy removed the old file that this tab still asks for.
const CHUNK_LOAD_ERROR =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i;

// The router's `errorElement`: shown instead of a page (or the layout) that threw while rendering.
// It never shows the error's message or stack: they can reveal internals and do not help the user.
// The full error is in the browser console (React Router logs it).
export function RouteErrorPage() {
  const error = useRouteError();
  const isChunkLoadError = error instanceof Error && CHUNK_LOAD_ERROR.test(error.message);

  return (
    <div role="alert" className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">
        {isChunkLoadError ? 'This page could not be loaded' : 'Something went wrong'}
      </h1>
      <p className="text-gray-700">
        {isChunkLoadError
          ? 'Check your connection, or the app was updated. Reloading gets the latest version.'
          : 'An unexpected error happened while showing this page. Reloading often helps.'}
      </p>
      <div className="flex items-center gap-4">
        {/* A full reload, not a client-side retry: React.lazy remembers a failed download forever. */}
        <Button onClick={() => window.location.reload()}>Reload the page</Button>
        {/* The router clears the error when the URL changes, so this link works without a reload. */}
        <Link to={PATHS.home} className="text-sm text-blue-700 underline hover:text-blue-900">
          Go to the home page
        </Link>
      </div>
    </div>
  );
}
