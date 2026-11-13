# PR 11: CSRF protection (Origin check + signed double-submit token)

## What and why
The refresh cookie is sent by the browser on its own, so another site could make a logged-in user's browser call
login, refresh, or logout (CSRF, goal.md: "XSS, CSRF"). Now every POST/PUT/PATCH/DELETE on the web API needs two
things another site cannot provide: an allowed `Origin` header, and a CSRF token that is both in a cookie and in the
`X-CSRF-Token` header. The token is signed with `CSRF_SECRET`, so made-up values are rejected; the `__Host-`
cookie prefix stops a subdomain from planting its own token.

## Changes
- `backend-express/src/lib/csrf/core.ts`: `createCsrfTokenService({ secret })` → `create()`, `verify(cookie, header)`
  (format, constant-time equal, HMAC signature); `isSafeMethod`, `isAllowedOrigin` (missing and `null` are rejected).
- `backend-express/src/lib/csrf/express.ts`: `createCsrfProtection(...)` → `protect` middleware (403 `CSRF_INVALID`)
  and `issueToken` (reuses a still-valid `__Host-csrf` cookie or sets a new one, returns `{ csrfToken }`).
- `backend-express/src/lib/csrf/index.ts`, `README.md`: public API and usage.
- `backend-express/src/app/app.ts`: `csrf.protect` after `cookie-parser`, before all web routes; `X-CSRF-Token` in CORS `allowedHeaders`.
- `backend-express/src/app/routes/auth.routes.ts`: `GET /api/auth/csrf`.
- `config.ts`, `security.ts`, `.env.example`, `scripts/setup-env.mjs`: new required secret `CSRF_SECRET` (must differ from `JWT_SECRET`).

Side effects: `POST /api/demo/validation` now needs `Origin` + token too, and an unsafe request to an unknown web
path (`POST /api/typo`) gets 403 `CSRF_INVALID` instead of 404 (the check runs before the 404 handler; fails closed).

## How to test
Run `node scripts/setup-env.mjs` first (it adds `CSRF_SECRET` to `.env`), then `npm run dev` in `backend-express`.
```bash
O='Origin: http://localhost:5173'
T=$(curl -s -c jar.txt http://localhost:4000/api/auth/csrf | node -pe 'JSON.parse(require("fs").readFileSync(0)).csrfToken')
L='{"email":"user@example.com","password":"User1234!"}'
# 403 "Request origin is not allowed" (no Origin; same with Origin: https://evil.example or null)
curl -s -b jar.txt -X POST localhost:4000/api/auth/login -H 'Content-Type: application/json' -H "X-CSRF-Token: $T" -d "$L"
# 403 "Invalid or missing CSRF token" (no header)
curl -s -b jar.txt -X POST localhost:4000/api/auth/login -H "$O" -H 'Content-Type: application/json' -d "$L"
# 200 (Origin + cookie + header)
curl -s -b jar.txt -c jar.txt -X POST localhost:4000/api/auth/login -H "$O" -H 'Content-Type: application/json' -H "X-CSRF-Token: $T" -d "$L"
```
`POST /api/mobile/auth/login` still works without any of this (no cookies there).

## How to reuse in another project
Copy `src/lib/csrf/` and `src/lib/errors/`, install `express` and `cookie-parser`.
```ts
const csrf = createCsrfProtection({
  tokens: createCsrfTokenService({ secret: process.env.CSRF_SECRET! }),
  allowedOrigins: ['https://app.example.com'],
});
app.use(cookieParser());
app.use(csrf.protect);
app.get('/api/auth/csrf', csrf.issueToken);
```

## Verification
- `npm run typecheck` and `npm run build`: no errors.
- Smoke test (`node dist/index.js` + curl): `GET /csrf` → 200 with `__Host-csrf` cookie (`HttpOnly; Secure; SameSite=Strict; Path=/`)
  and `Cache-Control: no-store`; login with no / foreign / `null` Origin → 403; no header, no cookie, or a forged token
  with a bad signature → 403; login 200, refresh 200, logout 204 with everything; refresh without the header → 403;
  preflight allows `X-CSRF-Token`; mobile login 200 without CSRF; `GET /me` unchanged (401 without a token).
- After the review fixes: `GET /csrf` with a valid cookie returns the same token, without one a new token;
  `POST /api/typo` → 403; equal `JWT_SECRET` and `CSRF_SECRET` → startup fails ("must be different from JWT_SECRET").

## Review
code-reviewer and security-reviewer: no bypass found. All findings fixed:
- **Fixed (both reviewers):** `issueToken` made a new token on every call, so a second tab broke the first tab's
  token (403 on its next POST). It now returns the token from a still-valid cookie.
- **Fixed (both reviewers):** the README and interview answer said the HMAC signature stops cookie planting. It does
  not here (the token is not bound to a session, and anyone can get a signed pair); only `__Host-` does. Docs reworded.
- **Fixed (security, low):** config now rejects `CSRF_SECRET` equal to `JWT_SECRET` (one key per purpose).
- **Fixed (code, nit):** `isAllowedOrigin` rejects `null` even if a list contains it (a copied module could get
  "null" from an env var).
- **Fixed (code, nit):** README no longer says the token covers a missing `Origin` (that is rejected first).
- **Fixed (code, nit):** documented that an unsafe request to an unknown path now gets 403 instead of 404.

## Interview questions
1. **Why doesn't `SameSite=Strict` alone make CSRF protection unnecessary?** It is a browser feature: older browsers,
   a cookie set without it, or a request from a sibling subdomain (same site) still get through. Defense in depth.
2. **What is the weakness of plain double-submit, and how is it fixed here?** If an attacker can write a cookie (from
   a subdomain, or over plain HTTP), they plant a token they know and send the same value in the header. Here the
   `__Host-` cookie prefix stops that. The HMAC signature alone does not: anyone can get a valid signed token from
   `GET /csrf`. Only a signature over the session ID (OWASP's version) would stop planting by itself.
3. **Why check `Origin`, and why reject a missing one?** The browser sets it and a page cannot change it, so it shows
   who started the request. These cookie routes are only for browsers, and all current browsers send it on POST.
