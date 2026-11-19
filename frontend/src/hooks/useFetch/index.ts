// Loads data from the API for a component. The request is aborted when the component unmounts or the path
// changes, so no request outlives the component (no leak) and a late answer never overwrites newer data.
import { useEffect, useState } from 'react';
import type { HttpClient } from '@/lib/http';

export type FetchResult<T> = {
  // Set only after the CURRENT request succeeded.
  data: T | undefined;
  // Set only after the CURRENT request failed (an ApiError, NetworkError, TimeoutError, ...).
  error: unknown;
  isLoading: boolean;
  // Sends the request again (e.g. from a "Try again" button).
  reload: () => void;
};

// The answer to one request, labeled with the request it belongs to.
type Settled<T> = {
  requestNumber: number;
  data: T | undefined;
  error: unknown;
};

export function useFetch<T>(http: HttpClient, path: string): FetchResult<T> {
  const [requestNumber, setRequestNumber] = useState(0);
  const [prevPath, setPrevPath] = useState(path);
  const [settled, setSettled] = useState<Settled<T> | null>(null);

  // A new path is a new request, even when it is a path we loaded before (A → B → A).
  // Set during render (React's "previous props" pattern), so no render shows the old answer as current.
  if (path !== prevPath) {
    setPrevPath(path);
    setRequestNumber((number) => number + 1);
  }

  useEffect(() => {
    const controller = new AbortController();

    http.request<T>(path, { signal: controller.signal }).then(
      (data) => {
        // Aborted = this component no longer wants this answer (unmounted, or a newer request started).
        if (controller.signal.aborted) {
          return;
        }
        setSettled({ requestNumber, data, error: undefined });
      },
      (error: unknown) => {
        // Our own abort is not a failure to show.
        if (controller.signal.aborted) {
          return;
        }
        setSettled({ requestNumber, data: undefined, error });
      },
    );

    // Runs on unmount and before the next request: cancels the network request and any retry wait.
    return () => {
      controller.abort();
    };
  }, [http, path, requestNumber]);

  // An answer to an older request is not shown, so `isLoading` is derived here instead of being set
  // inside the effect (setState in an effect body costs an extra render).
  const isCurrent = settled?.requestNumber === requestNumber;

  return {
    data: isCurrent ? settled.data : undefined,
    error: isCurrent ? settled.error : undefined,
    isLoading: !isCurrent,
    reload: () => setRequestNumber((number) => number + 1),
  };
}
