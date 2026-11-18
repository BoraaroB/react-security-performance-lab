# PR 18a: HTTP client core (typed errors, timeout, abort)

## What and why
The frontend needs one way to call the API. Plain `fetch` waits as long as the server lets it, treats a 404 as success,
and gives the same `TypeError` for "offline" and "blocked by CORS". `lib/http` wraps `fetch` with a timeout and
cancellation, turns every failure into a typed error (`ApiError` with the server's `code` and request ID, `NetworkError`,
`TimeoutError`), and refuses to send a request (or follow a redirect) outside the API origin (goal.md: API security, DX).
Step 18 was split (user's choice): 18a = this core, 18b = retry + backoff, 18c = `useOnlineStatus` + offline banner.

## Changes
- `frontend/src/lib/http/errors.ts`: `ApiError` (`status`, `code`, `details`, `requestId`), `NetworkError`, `TimeoutError`.
- `frontend/src/lib/http/client.ts`: `createHttpClient({ apiOrigin, timeoutMs?, credentials? })` → `request<T>(path, options)`.
- `frontend/src/lib/http/index.ts` + `README.md`: public API and usage.
- `frontend/src/config/http.ts`: the app's one client, `VITE_API_ORIGIN` (default `http://localhost:4000` in dev only;
  a production build needs it, and `https://` unless it is localhost).
- `frontend/src/vite-env.d.ts`, `frontend/.env.example`: type and placeholder for `VITE_API_ORIGIN`.
- `frontend/src/pages/ComponentsPage.tsx`: "HTTP client" demo card (health, 404, 1 ms timeout).

## How to test
```bash
cd backend-express && npm run dev     # API on :4000
cd frontend && npm run dev            # open http://localhost:5173/components
```
- "Health check" → green toast. "Missing route (404)" → red toast `404 (NOT_FOUND)` + `Request ID: <uuid>`
  (the same ID is in the API's log line). "Timeout (1 ms)" → "took too long". Stop the API, "Health check" → "could not be reached".

## How to reuse in another project
Copy `src/lib/http/` (no npm packages). Create one client in app glue:
```ts
export const http = createHttpClient({ apiOrigin: import.meta.env.VITE_API_ORIGIN });
const posts = await http.request<Post[]>('/api/posts', { signal });
```

## Verification
- `npm run typecheck`, `npm run lint`, `vite build`: pass (`ComponentsPage` chunk 7.0 kB; main file unchanged, the client is only imported by the lazy page).
- Node script against the running API: health OK; 404 → `ApiError NOT_FOUND` + request ID; `GET /api/demo/validation?page=abc`
  → `VALIDATION_ERROR` with `details: [{ field: "page", ... }]`; `timeoutMs: 1` → `TimeoutError`; port 4999 → `NetworkError`;
  caller abort → `AbortError` rethrown; `//evil.com/x` and `https://evil.com/x` → throw; `apiOrigin` with a path → throws;
  GET with a body → throws (after the review fixes, re-run: same results).
- Headless Chrome (real CORS): the three buttons gave the expected toasts; with the API stopped → `NetworkError` toast.
- Size: ~180 lines of code without comments (a bit over ~150; the demo card is 35 of them).

## Review
- security-reviewer [low]: `fetch` follows redirects, so the origin check covered only the first hop. **Fixed:** `redirect: 'error'`.
- security-reviewer [low]: a production build accepted `http://` for any host. **Fixed:** `config/http.ts` throws
  unless it is `https://` or localhost (same rule as the API).
- code-reviewer [should-fix]: a GET with a body, or a missing `AbortSignal.any` (old Safari), was reported as
  `NetworkError`. **Fixed:** `AbortSignal.any` moved above the `try`; a GET with a body throws a plain `Error`.
- code-reviewer [should-fix]: comments/docs said the origin check stops cookie leaks; the browser picks cookies by the
  target host anyway. **Fixed:** reworded everywhere to "the body and the headers the client adds".
- code-reviewer [nit]: redirects (same as the first item). **Fixed.**
- code-reviewer [nit]: the `ApiError` comment missed the 2xx `INVALID_RESPONSE` case. **Fixed.**
- code-reviewer [nit]: `details` items are cast, not checked. **Comment added; postponed** to step 20 (Known gaps).

## Interview questions
1. **Why does `fetch` need a timeout?** It has none by default; a hanging server keeps the request (and a spinner)
   alive for minutes. `AbortSignal.timeout(ms)` aborts it; `AbortSignal.any` combines it with the caller's signal.
2. **Why is a 404 not an exception in plain `fetch`?** `fetch` rejects only when no response arrives; any status is a
   "successful" response. The client checks `response.ok` and throws `ApiError`.
3. **Why check that the URL stays on the API origin?** `new URL('//evil.com', base)` leaves the base. A client that
   adds an `Authorization` or CSRF header must never send it to a host built from user input. (Cookies are not the
   reason: the browser picks them by the target host.) Redirects are refused for the same reason.
