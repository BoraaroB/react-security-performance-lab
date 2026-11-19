import { Alert, Button } from '@/components/ui';
import { ApiError, NetworkError, TimeoutError } from '@/lib/http';

export type ErrorStateProps = {
  // The error from a failed request (e.g. `useFetch(...).error`).
  error: unknown;
  // Called by the "Try again" button (e.g. `useFetch(...).reload`).
  onRetry: () => void;
  // Default: 'Could not load the data'.
  title?: string;
};

// Shown in place of data that failed to load. The text depends on the error TYPE, never on `error.message`:
// a message can reveal internals, and the server's wording can change.
export function ErrorState({ error, onRetry, title = 'Could not load the data' }: ErrorStateProps) {
  let text = 'Something went wrong. Please try again.';
  if (error instanceof NetworkError) {
    text = 'The server could not be reached. Check your connection and try again.';
  } else if (error instanceof TimeoutError) {
    text = 'The server took too long to answer. Please try again.';
  } else if (error instanceof ApiError && error.status === 429) {
    text = 'Too many requests. Please wait a moment and try again.';
  } else if (error instanceof ApiError && error.status >= 500) {
    text = 'The server had a problem. Please try again later.';
  }

  // The code and request ID let support find the matching line in the server log.
  const apiError = error instanceof ApiError ? error : undefined;

  return (
    <Alert variant="error" title={title}>
      <p>{text}</p>
      {apiError && (
        <p className="mt-1 text-xs">
          Error code: {apiError.code} · Request ID: {apiError.requestId ?? 'unknown'}
        </p>
      )}
      <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
        Try again
      </Button>
    </Alert>
  );
}
