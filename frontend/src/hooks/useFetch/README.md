# useFetch

Loads data from the API inside a component and returns `{ data, error, isLoading, reload }`. The request is
aborted with an `AbortController` when the component unmounts or the path changes, so no request keeps running
for a component that is gone (no leak), and a slow answer for an old path never replaces newer data (no race).

## Dependencies
- npm: `react@^18`
- lib: `http` (`HttpClient`; the hook passes it the `signal`)

## Usage
```tsx
import { useFetch } from '@/hooks/useFetch';
import { ErrorState } from '@/components/feedback/ErrorState';
import { http } from '@/config/http';

function PostList() {
  const { data, error, isLoading, reload } = useFetch<Post[]>(http, '/api/posts');

  if (isLoading) return <Spinner />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  return <ul>{data?.map((post) => <li key={post.id}>{post.title}</li>)}</ul>;
}
```

## Return value
| Field | Meaning |
|---|---|
| `data` | The answer of the current request, `undefined` while loading or after an error |
| `error` | Why the current request failed (`ApiError`, `NetworkError`, `TimeoutError`, ...), else `undefined` |
| `isLoading` | `true` until the current request has an answer (also after a new `path` or `reload()`) |
| `reload` | Sends the request again (for a "Try again" button) |

## Notes
- Pass a client created once (e.g. `@/config/http`), not inside the component: the client is an effect
  dependency, so a new client on every render would refetch forever.
- GET only. Writes (POST/PUT/DELETE) are user actions: call `http.request` from the event handler instead.
- In development, `StrictMode` runs every effect twice, so the Network tab shows one cancelled request and one
  real one. That is the abort working, not a bug.
- No cache: two components with the same path send two requests. For caching use a library (TanStack Query, SWR).

## How to reuse
Copy `src/hooks/useFetch/` and `src/lib/http/`. Frontend imports have no `.js` extension.
