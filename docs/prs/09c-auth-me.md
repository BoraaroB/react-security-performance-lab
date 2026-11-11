# PR 09c: `loadCurrentUser` + `GET /api/auth/me`

## What and why
The access token carries only the user's ID (`sub`), so a protected route must look up the user it belongs to.
`loadCurrentUser(users)` runs after `authenticate`, loads the user by `sub`, and puts the public shape on `req.user`.
If the user no longer exists (deleted, or the in-memory store was reset), the request gets 401 `UNAUTHORIZED` right
away, even though the token's signature is still valid. `GET /api/auth/me` → `{ user }` is the first route that uses it
(the frontend calls it to know who is logged in). Topic: S2 (authentication and authorization).

## Changes
- `src/app/middleware/current-user.middleware.ts` (new): `loadCurrentUser(users)` + the `req.user` type (`PublicUser`, no `passwordHash`).
- `src/app/app.ts`: builds `requireUser = [authenticate(accessTokens), loadCurrentUser(users)]` once and passes it to the auth router.
- `src/app/routes/auth.routes.ts`: `createAuthRouter({ auth, requireUser })`; `GET /me`.
- `src/app/controllers/auth.controller.ts`: `me` handler → `{ user }`.

## How to test
```bash
cd backend-express && npm run dev
J='Content-Type: application/json'
TOKEN=$(curl -s -H "$J" -d '{"email":"user@example.com","password":"User1234!"}' localhost:4000/api/auth/login | node -pe 'JSON.parse(require("fs").readFileSync(0)).accessToken')
curl -si -H "Authorization: Bearer $TOKEN" localhost:4000/api/auth/me   # 200 {"user":{id,email,name,role}}, no-store
curl -si localhost:4000/api/auth/me                                      # 401 UNAUTHORIZED, WWW-Authenticate: Bearer
# Restart the server (the in-memory store gets new user IDs), then repeat the first /me call:
# 401 UNAUTHORIZED: the token is still validly signed, but its user is gone.
```

## How to reuse in another project
App code, not a `lib` module. The pattern: `authenticate` (token → `req.auth`), then a small middleware that loads the
user by `req.auth.sub` from your own data layer (→ 401 if missing) and sets a public shape on `req.user`.
```ts
const requireUser = [authenticate(accessTokens), loadCurrentUser(users)];
router.get('/me', requireUser, (req, res) => res.json({ user: req.user }));
```

## Verification
- `npm run typecheck` and `npm run build`: pass.
- curl: valid token → 200 `{ user }` (no `passwordHash`), `Cache-Control: no-store`; no token → 401 `UNAUTHORIZED`
  + `WWW-Authenticate: Bearer`; garbage or tampered token → 401 "Invalid access token"; old token after a server
  restart (user ID gone) → 401 `UNAUTHORIZED` + `WWW-Authenticate: Bearer`; login still 200. No token in the server log.

## Review
code-reviewer and security-reviewer: no findings.

## Interview questions
1. **The JWT is valid. Why look up the user anyway?** A token cannot be changed or revoked after it is issued. Without the
   lookup, a deleted or banned user (or a demoted admin, if the role were in the token) keeps access until the token
   expires. A primary-key lookup per request is cheap in a monolith.
2. **What is the difference between `req.auth` and `req.user`?** `req.auth` is what the token claims (only `sub`),
   checked by signature alone. `req.user` is the user as the server knows it right now (current role). Authorization
   decisions (step 12) use `req.user`, never the token.
3. **Why not put the full user on `req.user`?** It would include `passwordHash`. One careless `res.json(req.user)` or
   log line would leak it. Keeping only the public fields on the request removes that risk.
