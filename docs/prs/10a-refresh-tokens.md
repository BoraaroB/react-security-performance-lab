# PR 10a: `lib/refresh-tokens` (rotation + reuse detection)

## What and why
Access tokens live only 15 minutes and cannot be revoked. A refresh token lets the client get a new one without
logging in again, so it lives long (7 days) and must be revocable. This module creates random (opaque) refresh tokens,
stores only their SHA-256 hash, and makes each token work once (rotation). If an already used token comes back, two
parties hold it (the user and a thief), so the whole family (every token from that login) is revoked.
No HTTP yet: the cookie and `POST /api/auth/refresh` come in 10b, logout in 10c. Topic: S2 (authentication).

## Changes
- `src/lib/refresh-tokens/core.ts` (new): `createRefreshTokenService({ store, ttlSeconds?, absoluteTtlSeconds? })` →
  `issue(userId)`, `rotate(token)`; `RefreshTokenError` (`REFRESH_TOKEN_INVALID`, `REFRESH_TOKEN_REUSED`); the `RefreshTokenStore` interface.
- `src/lib/refresh-tokens/memory-store.ts` (new): `createMemoryRefreshTokenStore()` (a `Map`, with `clear()`).
- `src/lib/refresh-tokens/index.ts`, `README.md` (new).

## How to test
Not wired into the app yet. A temporary script (not committed) ran the module with `npx tsx` from `backend-express/`:
`issue` → `rotate` → `rotate` the OLD token again → `REFRESH_TOKEN_REUSED`, and the newer token is dead too.
See "Verification" for the full list.

## How to reuse in another project
Copy `src/lib/refresh-tokens/`. No npm packages. In CommonJS (Nest), drop the `.js` in imports.
```ts
const store = createMemoryRefreshTokenStore(); // or your own RefreshTokenStore (database, Redis)
const refreshTokens = createRefreshTokenService({ store });
const issued = await refreshTokens.issue(user.id); // login: put issued.token in an httpOnly cookie
const next = await refreshTokens.rotate(cookieToken); // refresh: new token for next.userId, or RefreshTokenError
```

## Verification
- `npm run typecheck`, `npm run build`: pass. Portability grep (`../../`, `process.env`): no hits.
- Temporary script: token is 43 characters; rotate gives a new token for the same user; reusing the old token →
  `REFRESH_TOKEN_REUSED`, then the newer token → `REFRESH_TOKEN_INVALID` (family revoked); garbage and unknown tokens →
  `REFRESH_TOKEN_INVALID`; the store has no record under the plain token; two parallel rotations of one token →
  both `REFRESH_TOKEN_REUSED`, family revoked (also with a store whose `save` is 50 ms slow, like a database); an
  expired but already used token → `REFRESH_TOKEN_REUSED`, and the newer token is dead; expired token →
  `REFRESH_TOKEN_INVALID`; rotation never extends past the family's end; `ttlSeconds: 0`, `1.5`,
  `absoluteTtlSeconds < ttlSeconds`, or `absoluteTtlSeconds: 1e13` → `INVALID_REFRESH_TOKEN_CONFIG`.

## Review
- **Fixed (both reviewers, medium):** with a real database, a request that lost `markUsed` could delete the family
  before the winner's new token was saved, so that token lived on in a revoked family. `rotate` now checks after the
  save that the used token still exists (`deleteFamily` removes it); if not, it revokes again and throws `REUSED`.
  Side effect: two parallel rotations of one token now BOTH fail (safe; the frontend must refresh one at a time).
- **Fixed (code-reviewer):** reuse detection was skipped once the old token had expired (the expiry check ran first),
  so a user back after a week could not catch a thief. The "already used?" check now runs before the expiry check.
- **Fixed (code-reviewer, nit):** `absoluteTtlSeconds` has an upper bound (1 year); `1e13` would give an invalid date.
- **Postponed to 10b (security-reviewer, low):** send one 401 body for `REUSED` and `INVALID` (no oracle for a thief)
  and log `REUSED` server-side; after `rotate`, check that the user still exists. Listed in PROGRESS "Known gaps".
- **Postponed to 10c (security-reviewer, note):** idempotent `revoke`; no "revoke all of a user's families" yet.
- **Fixed (security-reviewer):** PROGRESS said "tested"; reworded to "temporary script, no test file yet".

## Interview questions
1. **Why is the refresh token not a JWT?** It must be revocable (logout, theft), so the server looks it up on every
   use anyway. Once there is a lookup, a signature adds nothing; a random 256-bit value is simpler and leaks nothing.
2. **What is refresh token rotation, and how does it detect theft?** Every refresh uses up the old token and returns a
   new one. A token can then be presented only once; a second use means someone copied it. The server cannot tell who
   is the thief, so it revokes the whole family and both must log in again (the real user can, the thief cannot).
3. **Why store a hash, and why SHA-256 and not bcrypt?** A leaked database then holds no usable tokens. bcrypt is slow
   on purpose to stop guessing weak passwords; a 256-bit random token cannot be guessed, so a fast hash is enough.
