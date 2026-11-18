# PR 18b: Retry with exponential backoff in the HTTP client

## What and why
A phone that switches networks, or an API that restarts during a deploy, fails a request for a second or two.
Without retries the user sees an error for something that would have worked a moment later. `lib/http` now retries
a GET after a passing failure (network error, timeout, 408/429/502/503/504). It waits longer each time, with random
jitter, and honors the server's `Retry-After`. A cancelled request also stops its wait. Only GET is retried: repeating
a POST could create the same post twice (goal.md: API security; jitter and `Retry-After` keep clients from
hammering a server that is already struggling).

## Changes
- `frontend/src/lib/http/retry.ts` (new): `parseRetryAfterMs` (seconds or HTTP date), `getRetryDelayMs` (which errors
  are retried and how long to wait), `wait` (a delay that the caller's `AbortSignal` cancels, listener cleaned up).
- `frontend/src/lib/http/client.ts`: the old `request` became `requestOnce`; the new `request` loops around it.
  New options `retries` (default 2, also per request) and `maxRetryDelayMs` (default 10 s).
- `frontend/src/lib/http/errors.ts`: `ApiError.retryAfterMs` (from the `Retry-After` header).
- `frontend/src/lib/http/index.ts`, `README.md`: a "Retries" section and the new options.

## How to test
```bash
cd frontend && npm run dev     # API NOT running; open http://localhost:5173/components, DevTools → Network
```
- "Health check" → 3 failed requests to `/api/health`, spaced out (random, up to 0.5 s then 1 s), then the
  "could not be reached" toast.
- Start the API (`cd backend-express && npm run dev`), "Missing route (404)" → exactly 1 request (4xx is not retried).
- "Timeout (1 ms)" → 3 requests, then the "took too long" toast.

## How to reuse in another project
Copy `src/lib/http/` (no npm packages). Retries are on by default for GET; tune or turn them off:
```ts
const http = createHttpClient({ apiOrigin, retries: 3, maxRetryDelayMs: 5_000 });
await http.request('/api/health', { retries: 0 });   // e.g. a poll that runs again anyway
```

## Verification
- `npm run typecheck`, `npm run lint`, `vite build`: pass (`ComponentsPage` chunk 8.1 kB).
- Node script (client bundled with esbuild) against a mock server that counts attempts:
  503, 503, 200 → success after 3 attempts; 429 + `Retry-After: 1` → 2 attempts, ~1 s; `Retry-After` as an HTTP date →
  2 attempts; `Retry-After: 60` → 1 attempt, `retryAfterMs = 60000`; 500, 404, POST 503, `retries: 0` → 1 attempt each;
  abort during the wait → `AbortError` after 100 ms, no more attempts; closed port → `NetworkError` after 2 waits.
- Real Express API: 6 calls to `/api/demo/rate-limit` → the 6th is a 429 with `Retry-After: 60` (the seconds left in
  the window) → above the 10 s cap, not retried, `retryAfterMs = 60000` + request ID.
- After the review fixes: `retries: NaN`, `Infinity`, `-1` throw; `maxRetryDelayMs: NaN` throws at creation;
  `Retry-After: 1.5` and ` 5` → backoff instead of a 0 ms wait; the mock-server script gave the same results again.

## Review
- security-reviewer [low] + code-reviewer [nit]: `retries` / `maxRetryDelayMs` were not checked; `NaN` or `Infinity`
  retried forever (with `NaN` delays: a tight loop). **Fixed:** `maxRetryDelayMs` is checked in `createHttpClient`,
  the resolved `retries` (client or per request) in `request`; both throw a plain `Error`.
- code-reviewer [should-fix]: `PROGRESS.md` said our limiters always send 60 s; they send the seconds left in the
  window, so a 429 near the end of a window is retried. **Fixed** the wording (the behavior was already right).
- code-reviewer [nit]: `Date.parse` is lenient (`"1.5"` → a 2001 date → 0 ms wait, confirmed in Node). **Fixed:**
  only an IMF-fixdate (`HTTP_DATE` regex) is parsed; anything else uses the normal backoff.
- code-reviewer [nit]: a 154-character comment line in `index.ts`. **Fixed** (rewrapped).

## Interview questions
1. **Which requests are safe to retry automatically?** Idempotent ones, where repeating gives the same result.
   GET is the safe choice. If only the response to a POST was lost, the server already did the write, so a retry
   would do it twice. (APIs that must retry writes use an `Idempotency-Key` header.)
2. **Why exponential backoff with jitter?** Backoff gives a struggling server time to recover instead of hitting it
   in a tight loop. Jitter (a random delay) spreads clients out, so thousands that failed at the same moment do not
   all retry at the same moment (the "thundering herd").
3. **Why not retry a 500 or a 400?** A 4xx means the request itself is wrong, and a 500 is usually a bug: the same
   request fails the same way again. Retry only failures that pass: no response, timeout, 408/429/502/503/504.
