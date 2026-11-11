# PR 09a: `POST /api/auth/login`

## What and why
The first real auth route: email + password → `{ accessToken, user }`. Login is the favorite target for attacks, so it
has three protections: **no user enumeration** (an unknown email and a wrong password give the same 401
`INVALID_CREDENTIALS` AND take the same ~200 ms, because bcrypt also runs against a dummy hash), a **strict rate limit**
(10 tries / 15 min per IP), and `Cache-Control: no-store` (tokens must not end up in a cache). The response contains only
public user fields (an allowlist), never `passwordHash`. Old hashes are upgraded to the current cost at login.
Step 09 is split: 09a login, 09b register, 09c `loadCurrentUser` + `GET /auth/me`. Topic: S2 (auth).

## Changes
- `src/app/schemas/auth.schemas.ts`: `loginSchema` (email trimmed + format + max 254, password 1–72 characters).
- `src/app/services/auth.service.ts`: `createAuthService({ users, passwords, accessTokens })` → `login()` (dummy hash, one error for both cases, rehash).
- `src/app/controllers/auth.controller.ts`: `login` handler (request → service → JSON).
- `src/app/routes/auth.routes.ts`: `createAuthRouter(auth)`: `no-store` on all auth routes, login limiter, validation.
- `src/app/repositories/users.repository.ts`: `PublicUser` + `toPublicUser()` (allowlist), `updatePasswordHash()`.
- `src/app/security.ts`: shared `accessTokens` (issuer/audience fixed, 15 min).
- `src/app/logger.ts`: `passwordHash` added to the redacted keys (safety net).
- `src/app/app.ts`, `src/index.ts`: `createApp({ users })` (the repository is passed in), `/api/auth` mounted.

## How to test
```bash
cd backend-express && npm run dev
J='Content-Type: application/json'
curl -si -H "$J" -d '{"email":"user@example.com","password":"User1234!"}' localhost:4000/api/auth/login
# 200, Cache-Control: no-store, {"accessToken":"...","user":{"id","email","name","role"}}
curl -s -w ' %{time_total}s\n' -H "$J" -d '{"email":"user@example.com","password":"wrong"}' localhost:4000/api/auth/login
curl -s -w ' %{time_total}s\n' -H "$J" -d '{"email":"nobody@example.com","password":"wrong"}' localhost:4000/api/auth/login
# both: 401 INVALID_CREDENTIALS "Invalid email or password", both ~0.2 s
# repeat the wrong login: the 11th request in 15 minutes → 429 RATE_LIMITED + Retry-After
```

## How to reuse in another project
This is app code, not a `lib` module. The pattern is the reusable part: copy `auth.service.ts` and give it any
`users` with `findByEmail`/`updatePasswordHash` plus `lib/password` and `lib/jwt`.
```ts
const auth = createAuthService({ users, passwords, accessTokens });
router.post('/login', rateLimit({ windowMs: 15 * 60_000, limit: 10 }), validate({ body: loginSchema }),
  async (req, res) => res.json(await auth.login(req.body.email, req.body.password)));
```

## Verification
- `npm run typecheck` and `npm run build`: pass.
- curl (server started with `tsx`): valid login (email ` User@Example.com ` with spaces/capitals, extra `role` field
  ignored) → 200 with 4 public fields and `no-store`; wrong password → 401 in 0.198 s, unknown email → 401 in 0.200 s,
  identical bodies; bad email / missing password → 400 `VALIDATION_ERROR`; 73-character password → 400 with no bcrypt
  run; 11th request → 429 with `Retry-After` and `no-store`; `/api/health` has no `no-store`. Server log: password `[REDACTED]`.
- Temporary script: a user with a cost-10 hash logs in → stored hash becomes cost 12, the next login still works;
  the token's `sub` is the user's ID.

## Review
- **security-reviewer:** no must-fix or should-fix findings. Two low notes, postponed to "Known gaps" in PROGRESS.md:
  - the dummy hash uses the current cost, so after a cost increase, accounts with older hashes answer faster than
    unknown emails until their next login (not reachable today: every hash is cost 12);
  - failed logins and login 429s are logged without the client IP (a small side PR later).
- **code-reviewer (should-fix, docs):** login has no CSRF check yet, and the gap was not listed. Added to "Known gaps"
  (step 11 adds it; login CSRF needs a pre-session token from `GET /auth/csrf`).
- **code-reviewer (nit, docs):** "`no-store` on every `/api/auth` response" was not exact: the global 429, malformed
  JSON 400 and 413 are answered before the auth router. Reworded (those responses carry no tokens or user data).
- **code-reviewer (nit):** the same dummy-hash cost note as above; postponed with it.

## Interview questions
1. **What is user enumeration and how does this login prevent it?** Finding out which emails have accounts (for
   phishing or credential stuffing). Two leaks: different messages ("no such user" vs "wrong password") and different
   timing (an unknown email skips bcrypt, ~1 ms vs ~200 ms). Fix: one code/message, and always run bcrypt, against
   a dummy hash when the user does not exist.
2. **Why `Pick`/allowlist the user fields instead of deleting `passwordHash`?** A denylist breaks silently: a field
   added later (e.g. `mfaSecret`) would be sent to clients. An allowlist must be changed on purpose to expose more.
3. **Why rehash at login?** It is the only moment the server knows the plain password. Raising the bcrypt cost over the
   years then upgrades every active user's hash without forcing a password reset.
