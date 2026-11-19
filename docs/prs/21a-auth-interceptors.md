# PR 21a: Auth interceptors (in-memory token, CSRF header, single-flight refresh)

## What and why
The HTTP client gets **interceptors** (the axios pattern): `onRequest` adds the access token and the CSRF token to
every request, and `onResponseError` reacts to `401 TOKEN_EXPIRED` (refresh, then retry once) and `403 CSRF_INVALID`
(new CSRF token, then retry once). The access token lives only in memory, and parallel requests share ONE refresh.
That matters because the server treats a reused refresh token as theft and ends the session.
Covers S1 (CSRF, token storage) and S2 (session handling). Step 1 of 3 for plan step 21 (21b: AuthProvider, 21c: route guards).

## Changes
- `frontend/src/lib/http/client.ts`: new `interceptors` option. `onRequest` runs before every attempt and before the
  timeout starts. `onResponseError` runs once; its `retry()` skips the interceptor, so it can never loop.
- `frontend/src/lib/http/index.ts`, `README.md`: export and document the new types.
- `frontend/src/features/auth/auth.http.ts` (new): `authHttp` with the auth interceptors, the access token in memory,
  and the CSRF token and the refresh kept as shared promises (single flight).
- `frontend/src/features/auth/auth.api.ts`: login/register store the access token, and there is no more CSRF fetch before every POST.
- `frontend/src/config/http.ts`: only the public `http` client stays here (`authHttp` moved to `auth.http.ts`).
- `LoginPage.tsx`, `RegisterPage.tsx`: removed the "step 21" comments.

## How to test
```bash
cd backend-express && npm run dev
cd frontend && npm run dev
```
1. Open DevTools → Network, log in as `admin@example.com` / `Admin123!` → one `GET /api/auth/csrf`, then `POST /login`
   with an `X-CSRF-Token` header. Log in again → no second `/csrf` (the token is cached).
2. Application → Cookies → delete `__Host-csrf`, log in again → `POST /login` 403 `CSRF_INVALID`, a new `/csrf`, `POST /login` 200.
3. Application → Local Storage is empty: the access token is never stored there.

Nothing in the UI uses a protected route yet (21b), so the refresh path was tested with a script (see Verification).

## How to reuse in another project
Copy `src/lib/http/` (no npm packages). Copy `auth.http.ts` as a starting point, then change the paths and error codes.
```ts
const api = createHttpClient({
  apiOrigin: 'https://api.example.com',
  credentials: 'include',
  interceptors: { onRequest: addAuthHeaders, onResponseError: handleAuthErrors },
});
```

## Verification
- `npm run typecheck` (frontend): OK. `vite build`: OK.
- Smoke test against the real Express API: a Node script bundled with esbuild (from the scratchpad, not committed), with a cookie jar,
  the `Origin` header, and one faked `401 TOKEN_EXPIRED` on `/me`. Results: login fetches CSRF exactly once; 3
  parallel `/me` with an "expired" token → exactly 1 `POST /refresh`, all 3 succeed with the new token, and there is no extra CSRF fetch;
  with the CSRF cookie deleted, logout → 403 → one new `/csrf` → retry 204; `/refresh` without a session →
  `ApiError UNAUTHORIZED`, sent once (no loop).
- Found on the way: a refresh in the same second as login returned the SAME JWT (`iat` is in whole seconds, there is no `jti`).
  This is harmless, because the old token is just as valid until it expires.

## Review
Both reviewers found no high or medium issues.
- **Fixed:** a failed refresh cleared the access token on ANY error (network, timeout, 429) and could overwrite a
  login that finished meanwhile. Now it is cleared only on a 401, and only if the token did not change during the refresh (both reviewers).
- **Fixed:** the "never refresh yourself" guard now also covers `/csrf`. The refresh waits for the CSRF fetch, so a
  `TOKEN_EXPIRED` on `/csrf` would hang every request (not reachable today, security-reviewer).
- **Fixed:** stale Known gaps in `PROGRESS.md` (the CSRF-fetch gap is closed, and the 10a two-tabs entry is merged into the cross-tab one).
  Also fixed: a README note that the caller's abort is checked only after `onRequest`, and a comment about `authHttp` being declared below its use.
- **Postponed (Known gaps):** parallel `CSRF_INVALID` responses can fetch two different tokens, so one retry fails (rare). A refresh cut off
  by the client timeout after the server rotated the token looks like reuse later.
- **Accepted:** `auth.http.ts` has four named functions with one call site each. Inlining them would mean
  async try/catch inside the client options and `authHttp` used inside its own initializer.

## Interview questions
1. **Where do you keep the access token in an SPA, and why?** In memory (a JS variable). `localStorage` can be read by any
   script on the page (XSS). A page reload loses the token, so the `httpOnly` refresh cookie gets a new one.
2. **Five requests get 401 at the same time. What happens?** Single flight: the first one starts the refresh and stores its
   promise, and the others `await` the same promise, then all five retry once. Five refreshes would reuse one rotating refresh
   token, and reuse detection would end the session.
3. **How do you stop a refresh interceptor from looping?** The retried request skips the error interceptor (or uses a
   `_retry` flag in axios), and the refresh call itself never triggers a refresh (it would wait for its own promise).
