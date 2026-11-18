# http

A small `fetch` client: every request has a timeout and can be cancelled, failures become typed errors
(`ApiError`, `NetworkError`, `TimeoutError`) that carry the server's error `code` and request ID, and requests can
only go to the configured API origin (redirects are refused), so the body and the headers the client adds (e.g. an
access token) never reach another host. A GET that fails for a passing reason is retried with exponential backoff.

## Dependencies
- npm: none (browser `fetch`, `AbortSignal.timeout`, `AbortSignal.any`: Chrome 116+, Firefox 124+, Safari 17.4+)
- lib: none

## Usage
```ts
import { createHttpClient, ApiError, NetworkError, TimeoutError } from '@/lib/http';

const http = createHttpClient({ apiOrigin: 'https://api.example.com' });

try {
  const posts = await http.request<Post[]>('/api/posts', { signal: controller.signal });
} catch (error) {
  if (error instanceof ApiError) showError(messagesByCode[error.code], error.requestId);
  else if (error instanceof TimeoutError) showError('The server took too long');
  else if (error instanceof NetworkError) showError('You seem to be offline');
  else throw error; // AbortError: the caller cancelled, nothing to show
}
```

## Options
| Option | Type | Default | Description |
|---|---|---|---|
| `apiOrigin` | `string` | required | Exact origin (`https://api.example.com`, no path, no trailing slash). Paths like `/api/posts` are resolved against it; a path that leaves it (`//evil.com`, `https://...`) throws. |
| `timeoutMs` | `number` | `10000` | Covers the whole request, including reading the body. Can be overridden per request. |
| `credentials` | `RequestCredentials` | `'same-origin'` | Set `'include'` when the API is on another origin and needs its cookies. |
| `retries` | `number` | `2` | Extra attempts for a GET (see "Retries"), a whole number ≥ 0. Can be overridden per request (`retries: 0` turns it off). |
| `maxRetryDelayMs` | `number` | `10000` | The longest wait between attempts. A longer `Retry-After` from the server means "do not retry". |

`request<T>(path, { method?, body?, signal?, timeoutMs?, retries? })`: `body` is sent as JSON (a GET with a body throws). Returns the parsed JSON
(`undefined` for an empty body, e.g. 204). The result is NOT validated at runtime; `T` is a promise, not a check.

## Errors
| Error | When | Fields |
|---|---|---|
| `ApiError` | Status 4xx/5xx, or a 2xx body that is not JSON (`INVALID_RESPONSE`) | `status`, `code`, `message`, `details`, `requestId` |
| `NetworkError` | No response: offline, DNS, server down, CORS blocked, or a redirect (refused) | `cause` |
| `TimeoutError` | No full response within `timeoutMs` | `timeoutMs`, `cause` |
| `AbortError` (`DOMException`) | The caller's `signal` was aborted: rethrown as is | – |

The expected error body is `{ "error": { "code", "message", "details"?, "requestId" } }`. Other bodies (e.g. a
proxy's HTML 502 page) still give an `ApiError`, with `code` = `HTTP_<status>` and the `X-Request-Id` header as
`requestId` (cross-origin, the API must list it in `Access-Control-Expose-Headers`). Show users a text mapped from
`code`; `message` is for logs.

## Retries
- **Only GET.** A POST/PUT/PATCH/DELETE is never retried: if only the response was lost, the server may have already
  done the write, and sending it again could do it twice.
- **Only passing failures:** `NetworkError`, `TimeoutError`, and `ApiError` with status 408, 429, 502, 503, 504.
  Other 4xx (the request is wrong) and 500 (a server bug) would fail the same way again.
- **Delay:** the server's `Retry-After` (seconds or an HTTP date) when it sends one, also on the `ApiError` as
  `retryAfterMs` (cross-origin, the API must list it in `Access-Control-Expose-Headers`); otherwise a random delay up
  to 500 ms, 1 s, 2 s, ... ("full jitter", so many clients do not retry at the same moment).
- Aborting the caller's `signal` also cancels the wait (the promise rejects with the `AbortError`).
- `timeoutMs` is per attempt: with the defaults, the slowest failure takes about 3 × 10 s plus the delays.

## How to reuse
Copy `src/lib/http/`. Frontend imports have no `.js` extension. Create ONE client in app glue (e.g.
`src/config/http.ts`) from your environment variables, not inside the module.
