# http

A small `fetch` client: every request has a timeout and can be cancelled, failures become typed errors
(`ApiError`, `NetworkError`, `TimeoutError`) that carry the server's error `code` and request ID, and requests can
only go to the configured API origin (redirects are refused), so the body and the headers the client adds (e.g. an
access token) never reach another host.

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

`request<T>(path, { method?, body?, signal?, timeoutMs? })`: `body` is sent as JSON (a GET with a body throws). Returns the parsed JSON
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

## How to reuse
Copy `src/lib/http/`. Frontend imports have no `.js` extension. Create ONE client in app glue (e.g.
`src/config/http.ts`) from your environment variables, not inside the module.
