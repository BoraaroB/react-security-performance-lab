# feat: mobile auth routes (refresh token in the JSON body)

## What and why
A native app (iOS, Android) cannot rely on an `httpOnly` cookie the way a browser does, so it gets its own routes
under `/api/mobile/auth/*` that send and receive the refresh token in the JSON body. They reuse the same auth service
and `lib/refresh-tokens` (rotation, reuse detection, expiry). The routes are mounted **before CORS**: a browser can
never read their responses, so an XSS bug on the web frontend cannot get a refresh token from them (that would defeat
`httpOnly`). Topic: S2 (auth), S1 (CSRF/CORS).

## Changes
- `src/app/routes/mobile-auth.routes.ts`: `POST register`, `login`, `refresh`, `logout`; `Cache-Control: no-store`.
- `src/app/controllers/mobile-auth.controller.ts`: same service calls as the web controller; the body carries
  `{ accessToken, refreshToken, refreshTokenExpiresAt, user }`. Never reads or sets a cookie, so no CSRF is needed.
- `src/app/schemas/mobile-auth.schemas.ts`: `{ refreshToken }` body schema.
- `src/app/routes/auth.routes.ts`: login/register limiters moved into `createAuthLimiters()`, so web and mobile share
  ONE counter per IP (otherwise a password guesser gets 10 tries per router).
- `src/app/app.ts`: mobile chain (global limiter, JSON parser, router, own 404) mounted before `corsPolicy`.
- `src/app/services/auth.service.ts`: comment on `AuthResult` updated.
- `CLAUDE.md`, `next-step` skill, both reviewer agents: `feat/*` side branches added.

## How to test
```bash
cd backend-express && npm run dev
B=http://localhost:4000/api/mobile/auth
curl -s -X POST $B/login -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"User1234!"}'          # 200, refreshToken in the body, no Set-Cookie
curl -s -X POST $B/refresh -H 'Content-Type: application/json' -d '{"refreshToken":"<token>"}'  # 200, new token
curl -s -X POST $B/refresh -H 'Content-Type: application/json' -d '{"refreshToken":"<old token>"}'  # 401 (reuse)
curl -s -i -X POST $B/logout -H 'Content-Type: application/json' -d '{"refreshToken":"<token>"}'  # 204
curl -s -i -X OPTIONS $B/login -H 'Origin: http://localhost:5173' -H 'Access-Control-Request-Method: POST'
# 200 with only "Allow: POST", no Access-Control-Allow-Origin → the browser blocks the request
```

## How to reuse in another project
App glue, not a portable module. The pattern: mount the token-in-body routes before the CORS middleware, give them
their own body parser and 404, and share the strict limiters with the cookie routes:
```ts
app.use('/api/mobile', globalLimiter, parseJson);
app.use('/api/mobile/auth', createMobileAuthRouter({ auth, limiters }));
app.use('/api/mobile', notFoundHandler());
app.use(corsPolicy({ ... })); // everything below gets CORS
```

## Verification
- `npm run typecheck` and `npm run build`: pass.
- Smoke test (curl): login 200 with the token in the body and no cookie; refresh rotates; the old token → 401 and the
  family is revoked (the new one → 401 too); logout 204, then refresh → 401; logout without a token → 400
  `VALIDATION_ERROR`; preflight from `localhost:5173` → no CORS headers; `/API/MOBILE/auth/login` (uppercase) → no
  CORS headers either; unknown `/api/mobile/auth/me` → 404 without CORS; web login still has CORS + cookie;
  `GET /api/auth/me` works with the mobile access token; 4 mobile + 2 web logins → web `RateLimit` shows 4 of 10 left
  (shared counter); the request log shows `"refreshToken": "[REDACTED]"`.

## Size
About 180 changed lines of code, above the ~150 budget. About 30 of them are a pure move: the two limiters into
`createAuthLimiters()` and the composition-root block in `app.ts` (it must exist before the mobile mount).

## Review
- **Both reviewers:** "browsers can never read these responses" holds only while the frontend and the API are on
  different origins (a dev proxy or nginx on one origin turns the calls into same-origin, and CORS no longer applies).
  **Fixed:** said so in the `app.ts` comment, the PROGRESS decision, and a new Known gap for steps 14+ and 32.
- **code-reviewer, size (~180 lines):** **accepted** and noted in "Size" above; offered to split if wanted.
- **code-reviewer, nit:** the "one counter per IP" comment also covered the JSON parser, and the old "preflights are
  not counted" comment is not true for the mobile chain. **Fixed:** both comments reworded.
- **security-reviewer** also checked (safe): case, trailing slash and encoded paths, `OPTIONS`, cookies, shared
  limiters, redaction of `refreshToken` in logs, `no-store`.

## Interview questions
1. **Why not just return the refresh token in JSON to the web frontend too?** Any JavaScript on the page, including
   an XSS payload, could read it and use it for up to 30 days from anywhere. An `httpOnly` cookie hides it from JS.
2. **Why do the mobile routes need no CSRF check?** CSRF works because the browser attaches cookies on its own. These
   routes never read a cookie; the app sends the token explicitly, which another site cannot do.
3. **How does a mobile app store the refresh token safely?** iOS Keychain / Android Keystore (encrypted, per app),
   never plain storage. It sends one refresh at a time and replaces the token after every refresh (rotation).
