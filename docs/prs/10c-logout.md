# PR 10c: `POST /api/auth/logout`

## What and why
Until now a session could only end by expiring (up to 30 days). Logout must end it **on the server**: deleting the
cookie in the browser alone would leave a stolen copy of the refresh token working. This PR adds `revoke(token)` to
`lib/refresh-tokens` (deletes the token's whole family) and `POST /api/auth/logout`, which revokes, clears the cookie
and answers 204. It always answers 204, with or without a valid cookie (idempotent, reveals nothing).
Topic: S2 (authentication, session lifecycle).

## Changes
- `src/lib/refresh-tokens/core.ts`: `revoke(token)`: hash → `find` → `deleteFamily`. Never throws for a malformed,
  unknown, used or expired token.
- `src/lib/refresh-tokens/README.md`: `revoke` in the usage, API table and notes.
- `src/app/services/auth.service.ts`: `logout(token)`; no token → nothing to do.
- `src/app/controllers/auth.controller.ts`: shared `REFRESH_COOKIE_OPTIONS` (set and clear must use the same `path`,
  or the browser keeps the cookie), `readRefreshCookie(req)` (used by refresh and logout), `logout` handler.
- `src/app/routes/auth.routes.ts`: `POST /logout`, no `requireUser` (the access token may already have expired).

## How to test
```bash
cd backend-express && npm run dev
J='Content-Type: application/json'; B=localhost:4000/api/auth
curl -s -c jar -o /dev/null -H "$J" -d '{"email":"user@example.com","password":"User1234!"}' $B/login
curl -si -b jar -X POST $B/logout     # 204 + Set-Cookie: __Secure-refresh_token=; Path=/api/auth; Expires=Thu, 01 Jan 1970 ...
curl -s  -b jar -X POST $B/refresh    # 401 UNAUTHORIZED: the session is gone on the server, not just in the browser
curl -si -b jar -X POST $B/logout     # 204 again (idempotent)
curl -si -X POST $B/logout            # 204 without a cookie too
```

## How to reuse in another project
`lib/refresh-tokens` is copied as before (no npm packages). Logout handler:
```ts
const token = typeof req.cookies[NAME] === 'string' ? req.cookies[NAME] : undefined;
if (token) await refreshTokens.revoke(token); // never throws
res.clearCookie(NAME, { httpOnly: true, secure: true, sameSite: 'strict', path: '/api/auth' }); // same path as when set
res.status(204).end();
```

## Verification
- `npm run typecheck` and `npm run build`: pass.
- curl (script): logout → 204, `Cache-Control: no-store`, `Set-Cookie` that expires the cookie with the same
  `Path`/flags; refresh with the logged-out token → 401; an older (already used) token from the same login → 401;
  logout again → 204; no cookie, a garbage value, and a `j:{"a":1}` value → 204 (no 500); logout with an OLD used
  token also kills the newest token of that login; logging out session 1 leaves session 2 (second login) working
  (refresh → 200). No token value in the server log.

## Review
- **security-reviewer:** no findings. Checked: a logout racing with a refresh cannot leave a live token (`rotate`
  re-checks after saving); someone with an older used token can log the user out, which reuse detection already allows.
- **Fixed (code-reviewer, nit):** the "revoke first" comment now says why the ORDER matters: if revoking fails, the
  cookie stays and the client can retry.
- **Fixed (code-reviewer, nit):** the README usage said `revoke` "never throws"; it never throws for a bad token, but
  a failing store still rejects.
- **Noted (code-reviewer, nit):** the next side branch `feat/mobile-auth` is not a `chore/*`/`fix/*` name the workflow
  docs know. Kept the agreed name; `docs/PROGRESS.md` says that PR adds `feat/*` to the lists.

## Interview questions
1. **Why is deleting the cookie not enough for logout?** It only makes this browser forget the token. A copy (stolen
   by malware, a proxy log, a shared computer) would still work until it expires. The server must revoke it.
2. **Why does logout not require a valid access token?** It may have expired already (15 min), and the user still
   wants to be logged out. The refresh cookie says which session to end, and the answer is always the same 204.
3. **What does logout NOT do?** It does not kill access tokens already issued (they live up to 15 minutes; JWTs cannot
   be revoked without a deny-list), and it ends only this login, not the user's other devices ("log out everywhere"
   needs a "delete all families of a user" store method).
