# PR 08: JWT access tokens and the `authenticate` middleware

## What and why
Login (step 09) must give the client proof of who it is, and protected routes must check that proof on every request.
This PR adds `lib/jwt`: short-lived (15 min) signed access tokens and an Express `authenticate` middleware that accepts
only `Authorization: Bearer <token>`. The algorithm is pinned to HS256 and the issuer and audience are checked, so a
forged, altered (another user's ID), `alg: none`, expired, or foreign token is rejected. The token carries only the
user ID (`sub`), no role: the app loads the current user and role by ID (step 09/12), so a role change or a deleted
account applies at once. Topic: S2 (JWT).
(As merged in PR #15 the token also had `role`; the `sub`-only version described here landed in `fix/jwt-sub-only`.)

## Changes
- `backend-express/src/lib/jwt/core.ts`: `createAccessTokenService({ secret, issuer, audience, ttlSeconds? })` → `sign({ sub })`, `verify(token)`; `InvalidTokenError` (`TOKEN_EXPIRED` / `TOKEN_INVALID`), `AccessTokenConfigError` (secret < 32 bytes, TTL outside 1–3600 s).
- `backend-express/src/lib/jwt/express.ts`: `authenticate(service)` → sets `req.auth`, or 401 `UNAUTHORIZED` / `TOKEN_EXPIRED` with `WWW-Authenticate: Bearer`.
- `backend-express/src/lib/jwt/index.ts`, `README.md`: public API and docs.
- `backend-express/src/app/config.ts`, `.env.example`, `scripts/setup-env.mjs`: required `JWT_SECRET` (≥ 32 characters), generated as 32 random bytes.
- `backend-express/src/app/routes/demo.ts`: `GET /api/demo/jwt` (a token + which forged tokens are rejected) and `GET /api/demo/jwt/protected` (behind `authenticate`), with their own throwaway secret.
- `backend-express/package.json`: `jsonwebtoken@9.0.3`, dev `@types/jsonwebtoken@9.0.10`.

## How to test
```bash
node scripts/setup-env.mjs            # from the repo root: adds JWT_SECRET to backend-express/.env
cd backend-express && npm install && npm run dev
curl -s localhost:4000/api/demo/jwt   # token, decoded header/payload, verify: subChangedToOtherUser/algNone/otherAudience → TOKEN_INVALID
TOKEN=<token from above>
curl -s localhost:4000/api/demo/jwt/protected -H "Authorization: Bearer $TOKEN"  # 200 {"auth":{"sub":"demo-user-id"}}
curl -si localhost:4000/api/demo/jwt/protected                                    # 401 UNAUTHORIZED + WWW-Authenticate: Bearer
# wait 60 s, repeat the first protected call → 401 TOKEN_EXPIRED
```

## How to reuse in another project
Copy `src/lib/jwt/` and `src/lib/errors/`, then `npm i jsonwebtoken@^9 && npm i -D @types/jsonwebtoken@^9`.
```ts
const accessTokens = createAccessTokenService({ secret: process.env.JWT_SECRET!, issuer: 'my-api', audience: 'my-web' });
const accessToken = accessTokens.sign({ sub: user.id });
router.get('/me', authenticate(accessTokens), (req, res) => res.json({ userId: req.auth!.sub }));
```

## Verification
- `npm run typecheck` and `npm run build`: pass. Portability grep on `src/lib/jwt`: no hits.
- curl: `/api/demo/jwt` → valid token verifies, the three forged ones → `TOKEN_INVALID`; `/protected` with the token
  (also lowercase `bearer`) → 200; no header and `Basic ...` → 401 `UNAUTHORIZED` "Authentication required" with
  `WWW-Authenticate: Bearer`; `abc.def.ghi` → 401 "Invalid access token". No token appears in the server log.
- Temporary script: token without `exp`, other secret, `HS512` → `TOKEN_INVALID`; a 1 s token after 2 s → `TOKEN_EXPIRED`;
  secret `short`, TTL 0 and 3601 → `AccessTokenConfigError`. `JWT_SECRET=` / `JWT_SECRET=short` → startup error with the setup hint.
- Not run: `TOKEN_EXPIRED` through the HTTP route (needs a 60 s wait); the middleware maps it in one line.

## Review
- **security-reviewer:** no findings.
- **Fixed (code-reviewer, should-fix):** the `algNone` demo token had an empty signature, so jsonwebtoken rejected it
  with "jwt signature is required" before the `algorithms` check ran: the demo did not prove that pinning works. It now
  keeps the original signature, and the library rejects it with "invalid algorithm" (checked with a script).
- **Fixed (code-reviewer, nit):** the README said "weak or missing → throws"; the code only checks the length. It now says
  "shorter than 32 bytes → throws `AccessTokenConfigError`".
- **Fixed (code-reviewer, nit):** `sign` accepted an empty `sub` that `verify` always rejects (every request would get
  a confusing 401). `sign` now throws for an empty `sub`.
- **Changed after review (user's decision; landed in `fix/jwt-sub-only`, because PR #15 was merged before this commit
  was pushed):** the first version put `role` in the token. Now it carries only `sub`:
  a role in the token is a snapshot from login, so a demoted admin would keep admin rights for up to 15 minutes.
  The demo's tamper example now changes `sub` (acting as another user) instead of `role`. Both reviewers ran again:
  security-reviewer no findings; code-reviewer three doc nits, all fixed ("blocked accounts" → "deleted accounts",
  because the app has no blocking; a note in interview Q3 that loading the user does not revoke the token; step 09
  marked as a likely 09a/09b split in PROGRESS.md).

## Interview questions
1. **Why only the user ID in the token, not the role?** A token cannot be changed or revoked after it is issued, so a
   role in it is a snapshot from login: a demoted admin keeps admin rights until the token expires. With only `sub`, the
   server loads the user on each request (one cheap primary-key lookup), so role changes and deleted accounts apply at
   once. Microservices behind an identity provider usually do put roles/scopes in a short-lived token (RFC 9068),
   because they cannot reach the user database; sensitive actions are then re-checked.
2. **Why pin the algorithm in `verify`?** The token's header says which algorithm was used, and the attacker writes the
   header. With `alg: none` there is no signature at all; with an RS256 setup switched to HS256, the public key becomes
   the HMAC secret. Passing `algorithms: ['HS256']` makes the server decide, not the token.
3. **Why are access tokens short-lived?** A JWT is checked without a database, so it cannot be revoked: a stolen one
   works until `exp`. 15 minutes limits the damage; the revocable refresh token (step 10) keeps the session alive.
   (Loading the user by `sub` does not change this: it gets the user's current data, but after a logout the token
   itself still passes `authenticate` until `exp`. The token proves WHO without a session store.)
4. **Is a JWT encrypted? Where should the frontend keep it?** No, the payload is only base64url: never put secrets in it.
   Keep it in memory, not `localStorage` (any XSS script can read `localStorage`), and send it in the `Authorization`
   header, which a cross-site form cannot set.
