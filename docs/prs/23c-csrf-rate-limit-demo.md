# PR 23c: CSRF and rate-limit demos

## What and why
The API has had CSRF protection (step 11) and rate limiting (step 06) for a while, but you could only see them with curl.
Two new sections on `/security` show them from the browser: a POST without the CSRF token, with a made-up one, and
with the real one (403 `CSRF_INVALID` vs 200), and a button that hits `/api/demo/rate-limit` until it returns 429 with
`Retry-After`. goal.md: S1 (CSRF), S3 (API security). Third of the four step-23 PRs. Frontend only, no new dependencies.
The demo POSTs to a harmless echo route; the real CSRF targets in this API are the cookie routes (`/api/auth/*`:
refresh, logout, login). Routes with `Authorization: Bearer` cannot be forged (another page cannot add that header),
so the global CSRF check on them is defense in depth.

## Changes
- `frontend/src/features/security-demo/CsrfDemo.tsx`: three POSTs to `/api/demo/validation` (any write goes through
  the CSRF check). "No token" and "Made-up token" use their own `httpWithoutCsrf` client (cookies, no interceptors);
  "Real token" uses `authHttp`. Shows status, code and message, or the echoed body.
- `frontend/src/features/security-demo/RateLimitDemo.tsx`: "Send a request" calls `GET /api/demo/rate-limit` with
  `retries: 0` and lists each result (`200 OK`, or `429 RATE_LIMITED, Retry-After: N s`).
- `frontend/src/pages/SecurityPage.tsx`: adds both sections.

## How to test
`npm run dev:express`, open http://localhost:5173/security (no login needed). Expected results:
1. CSRF: "No token" and "Made-up token" → `403 CSRF_INVALID: Invalid or missing CSRF token`. "Real token (authHttp)"
   → `200 OK` and `{ "received": { ... } }`.
2. The Origin check (the browser sets `Origin`, so test it with curl):
   ```bash
   TOKEN=$(curl -s -c jar localhost:4000/api/auth/csrf | sed 's/.*"csrfToken":"\([^"]*\)".*/\1/')
   curl -s -b jar -X POST localhost:4000/api/demo/validation -H 'Origin: https://evil.example' \
     -H 'Content-Type: application/json' -H "X-CSRF-Token: $TOKEN" -d '{"name":"x","email":"x@example.com"}'
   # → 403 CSRF_INVALID "Request origin is not allowed" (with Origin: http://localhost:5173 → 200)
   ```
3. Rate limit: click "Send a request" 6 times → five `200 OK`, then `429 RATE_LIMITED, Retry-After: 60 s` (or less).
   DevTools → Network shows `RateLimit: "5-in-1min"; r=…` (and the global `"300-in-15min"`) on each response.

## How to reuse in another project
Nothing new to copy: the demos use `lib/http` and `features/auth/auth.http.ts`. The pattern worth reusing is a
client WITHOUT the auth interceptors for "show the raw error" pages:
```ts
const httpWithoutCsrf = createHttpClient({ apiOrigin: API_ORIGIN, credentials: 'include' });
await http.request('/api/demo/rate-limit', { retries: 0 }); // see the 429 instead of a silent retry
```

## Verification
- `npm run typecheck`, `npx eslint` on the changed files, `vite build`: OK (also after the review fixes). `SecurityPage` chunk 38.7 kB (was 35.4 kB).
- curl against the running Express API, with the headers the browser sends: CORS preflight allows `X-CSRF-Token`;
  no token → 403 `CSRF_INVALID`; cookie + made-up token → 403; cookie + real token → 200 with the echo; real token +
  `Origin: https://evil.example` → 403 "Request origin is not allowed". The 403 carries `Access-Control-Allow-Origin`,
  so the browser can read it (no NetworkError). Rate limit: requests 1–5 → 200 (`r=4` … `r=0`), 6th → 429 +
  `Retry-After: 60`; `Retry-After` and `RateLimit` are in `Access-Control-Expose-Headers`.
- The buttons were not clicked in a browser; the curl calls send the same requests.

## Review
- **security-reviewer, low (fixed):** the demo text and Q1 gave the wrong reason why other sites cannot read the
  token ("the cookie is httpOnly"). Another site can never read our cookies, httpOnly or not; the same-origin policy
  is the reason. They also said the browser adds the cookies anyway, but both cookies are `SameSite=Strict`, so a
  cross-site request carries none. The text and Q1 now say: SameSite stops cross-site requests, and the token covers
  same-site pages (sibling subdomains) and older browsers. (code-reviewer flagged the httpOnly part too, as should-fix.)
- **security-reviewer, low (fixed):** the demo route is not a real CSRF target. "What and why" now says the targets
  are the cookie routes (`/api/auth/*`); `Bearer` routes cannot be forged, so the check there is defense in depth.
- **code-reviewer, nit (fixed):** `RateLimitDemo` resets `isSending` in `finally`, the same way as `CsrfDemo`.
- **code-reviewer, nit (fixed):** "How to test" lists browser results, but the buttons were not clicked. It now
  says "Expected results"; Verification still says what was really run.
- Both reviewers confirmed: the separate client and `retries: 0` are needed, the 403/429 are readable through CORS,
  and with demo routes off only the real-token and rate-limit cases get 404. No other findings.

## Interview questions
1. **Our cookies are `SameSite=Strict`. Why also a CSRF token?** SameSite already keeps cookies off requests that
   another *site* starts. But a page on the same site (a sibling subdomain, another port on localhost) still gets
   them sent, and older browsers ignore SameSite. That page cannot read the token (the same-origin policy hides our
   cookies and the `GET /csrf` response; a custom header also needs a CORS preflight that the API refuses), so it
   cannot set `X-CSRF-Token`, and the server rejects the request. The `Origin` check is one more layer.
2. **Why did the demo need a separate HTTP client?** `authHttp`'s interceptor adds the real token and, after
   `CSRF_INVALID`, fetches a new one and retries. That is right for the app (an expired cookie heals itself) but would
   hide the 403 the demo wants to show.
3. **What should a client do with a 429?** Stop and wait `Retry-After` seconds (never retry in a tight loop). Our
   client retries a GET only if the wait is short (≤ 10 s); a POST is never retried, and a UI should tell the user to wait.
