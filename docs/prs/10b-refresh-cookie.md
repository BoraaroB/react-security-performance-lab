# PR 10b: Refresh cookie + `POST /api/auth/refresh`

## What and why
The access token lives only 15 minutes. This PR wires `lib/refresh-tokens` (10a) into the API, so the client can get
a new one without typing the password again. Login and register now also set a refresh token in a
`__Secure-refresh_token` cookie (`HttpOnly; Secure; SameSite=Strict`) that JavaScript cannot read (an XSS bug cannot steal it). `POST /api/auth/refresh` uses up the
cookie's token and returns a new access token plus a new refresh cookie (rotation). Every failure gets the same 401.
Logout comes in 10c. Topic: S2 (authentication), S1 (cookie flags against XSS/CSRF).

## Changes
- `src/app/services/auth.service.ts`: login/register start a refresh-token family; new `refresh(token)` (rotate →
  check that the user still exists → new tokens); one 401 `UNAUTHORIZED` for every failure.
- `src/app/controllers/auth.controller.ts`: `setRefreshCookie` (cookie flags), `sendAuthResult` (cookie + `{ accessToken, user }`
  only), `refresh` handler (accepts only a string cookie value).
- `src/app/routes/auth.routes.ts`: `POST /refresh` (global rate limit only).
- `src/app/app.ts`: `cookieParser()`; `createApp({ users, refreshTokens })`.
- `src/index.ts`: creates the refresh-token service (memory store, defaults 7 / 30 days).
- `package.json`: new dependency `cookie-parser` 1.4.7 (+ `@types/cookie-parser`). Express 5 does not read cookies on
  its own; this is the official Express middleware, and it uses the same `cookie` package Express already depends on.

## How to test
```bash
cd backend-express && npm run dev
J='Content-Type: application/json'; B=localhost:4000/api/auth
curl -si -c jar -H "$J" -d '{"email":"user@example.com","password":"User1234!"}' $B/login  # 200 + Set-Cookie: __Secure-refresh_token=...; HttpOnly; Secure; SameSite=Strict
cp jar jar-old
curl -si -b jar -c jar -X POST $B/refresh   # 200, new accessToken, NEW refresh cookie
curl -s -b jar-old -X POST $B/refresh       # 401 UNAUTHORIZED: old token reused → whole session revoked
curl -s -b jar -X POST $B/refresh           # 401 too: the newest token died with its family
curl -s -X POST $B/refresh                  # 401, the same body
```

## How to reuse in another project
App code, not a module. The pattern: on login, `refreshTokens.issue(user.id)` → `res.cookie(name, token, { httpOnly:
true, secure: true, sameSite: 'strict', path: '/api/auth', expires })` with a `__Secure-` name; on refresh, read `req.cookies[name]` (only a
string), `rotate` it, load the user, sign a new access token, set the new cookie. Install `cookie-parser`.

## Verification
- `npm run typecheck` and `npm run build`: pass.
- curl (script): login and register → `Set-Cookie: __Secure-refresh_token=…; Path=/api/auth; Expires=+7 days; HttpOnly;
  Secure; SameSite=Strict`, body without the refresh token, `Cache-Control: no-store`; refresh → 200 + a different
  cookie; old cookie → 401, then the newest cookie → 401 (family revoked); no cookie → 401; a `j:{"a":1}` cookie value
  → 401 (not 500); all four 401s have the same body; the access token from refresh works on `/me`; the cookie is not
  sent to `/api/health` (Path); no refresh-token value in the server log.
- Not tested over HTTP: a deleted user (there is no delete route yet). The check is one `findById` line.

## Review
- **Fixed (security-reviewer, low):** the cookie had no `__Secure-` prefix, so someone on the network could plant
  their own refresh token through a plain-HTTP response (before the user has a real one), and the next refresh would
  log the victim into the attacker's account. Renamed to `__Secure-refresh_token`: browsers accept it only over HTTPS
  with `Secure`. `__Host-` needs `Path=/`, so a sibling subdomain can still set it (listed in Known gaps).
- **Fixed (code-reviewer, nit):** the cookie-path comment said it goes only to refresh/logout; it also goes to login,
  register and `/me`.
- **Partly fixed (code-reviewer, nit):** the cookie `Path` repeats the mount path from `app.ts`. A shared constant
  would mean the controller imports from the routes file (an import cycle), so both places now have a comment pointing
  to the other instead.
- **Fixed (code-reviewer, nit):** `AuthResult` holds the raw refresh token; its doc comment now says never to
  `res.json()` it as it is (`sendAuthResult` picks the fields).
- **Fixed (code-reviewer, note):** "browsers treat `http://localhost` as secure" → "Chrome, Firefox and curl";
  Safari is checked in step 21.

## Interview questions
1. **Why does the refresh token go into a cookie, and the access token into memory?** The cookie is `HttpOnly`, so
   XSS cannot read the long-lived token. A cookie is sent automatically, which invites CSRF, so it is `SameSite=Strict`
   and limited to `/api/auth`. The short-lived access token is sent by hand in a header, so CSRF cannot use it.
2. **What does each cookie flag do?** `HttpOnly`: no JavaScript access. `Secure`: HTTPS only. `SameSite=Strict`: not
   sent on requests that another site starts. `Path`: sent only to matching URLs. `Expires`: how long the browser keeps it.
3. **Why the same 401 for "expired" and "reused"?** The client does the same thing in both cases (log in again).
   Different answers would tell someone with a stolen token that it was real, or that the theft was detected.
