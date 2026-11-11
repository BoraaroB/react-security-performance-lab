# PR 09b: `POST /api/auth/register`

## What and why
Sign-up: `{ name, email, password }` → 201 `{ accessToken, user }`, so the new user is logged in at once. Security
points: the role is always `user` (a `"role": "admin"` in the body is stripped: mass assignment), password rules follow
NIST SP 800-63B-4 (at least 15 characters, no forced "digit + symbol", at most 72 **bytes** because bcrypt ignores the
rest), the name may not contain invisible or control characters (spoofing), a taken
email gives 409 `EMAIL_TAKEN` (also when two sign-ups race), and a strict limiter of its own (5 per hour per IP).
Register cannot hide that an email is taken (see interview question 1). Topic: S2 (auth).

## Changes
- `src/app/schemas/auth.schemas.ts`: `registerSchema` (name 1–100 without control/invisible characters, shared `email` field, password ≥ 15 characters (code points) and ≤ 72 UTF-8 bytes).
- `src/app/services/auth.service.ts`: `register()` (fast `findByEmail` check, hash, `create` with `role: 'user'`, `EmailTakenError` → same 409); `issueTokens()` shared with `login`.
- `src/app/controllers/auth.controller.ts`: `register` handler → 201.
- `src/app/routes/auth.routes.ts`: `POST /register` with its own limiter (5 per hour).
- `docs/PROGRESS.md`: also restores the last "Known gaps" line, which PR 09a cut in half by mistake.

## How to test
```bash
cd backend-express && npm run dev
J='Content-Type: application/json'
curl -si -H "$J" -d '{"name":"Ana","email":"ana@example.com","password":"correct horse battery","role":"admin"}' localhost:4000/api/auth/register
# 201, {"accessToken":"...","user":{...,"role":"user"}}   (role "admin" was ignored)
curl -s -H "$J" -d '{"name":"X","email":"ANA@example.com","password":"whatever whatever"}' localhost:4000/api/auth/register
# 409 EMAIL_TAKEN (the email is compared after trim + lowercase)
curl -s -H "$J" -d '{"email":"ana@example.com","password":"correct horse battery"}' localhost:4000/api/auth/login   # 200
# the 6th register request in an hour → 429 RATE_LIMITED, Retry-After: 3600; login still works
```

## How to reuse in another project
App code, not a `lib` module. Reuse `registerSchema` (the byte check needs only `MAX_PASSWORD_BYTES` from `lib/password`)
and the `register()` pattern: check → hash → create, and catch the repository's "taken" error, because the check alone
loses a race.

## Verification
- `npm run typecheck` and `npm run build`: pass.
- curl: register with extra `role: "admin"` → 201, `role: "user"`, `no-store`; the new account logs in (200); taken email
  with other case/spaces → 409 in 1 ms (no bcrypt); two parallel sign-ups with one email → one 201, one 409 (the second
  passed the first check and was stopped by `create`, ~200 ms later); empty name / bad email / 5-character password →
  400 with three field errors; 24 emoji (96 bytes) → 400 "at most 72 bytes"; 18 emoji (72 bytes) → 201;
  after review: 14 characters → 400, 15 → 201 (Cyrillic name OK), 8 emoji (16 UTF-16 units) → 400 "too short",
  name with a zero-width space or a right-to-left override → 400; 6th request →
  429 with `Retry-After: 3600`, then login → 200 (separate counters). Server log: every password `[REDACTED]`.

## Review
- **Fixed (code-reviewer, should-fix):** the comment said "NIST: at least 8". The current NIST SP 800-63B-4 (2025)
  requires 15 when the password is the only factor (8 only as part of MFA). The minimum is now 15.
- **Fixed (both, nit):** `.min()` counted UTF-16 units, so 4 emoji passed as 8 "characters". Now `[...value].length`
  (Unicode code points, as NIST counts).
- **Fixed (security-reviewer, nit):** `name` accepted control and invisible characters (zero-width space, right-to-left
  override), which `trim()` keeps: a name could look empty or impersonate someone. Now NFC-normalized and rejected.
- **Documented (code-reviewer, should-fix):** the register limit is per IP, so people behind one shared IP share the 5
  per hour. Accepted trade-off, now in the route comment and PROGRESS. `skipFailedRequests` was not used: it would also
  skip the 409s and allow mass email probing (security-reviewer).
- **Postponed (security-reviewer, should-fix):** no check against common/breached passwords (NIST requires one) and no
  "password ≠ email" check. Needs a bundled list or the HIBP API: a separate concept. In "Known gaps".
- **Postponed (both, should-fix):** register has no CSRF check either; the existing known gap now names login and register (step 11).
- **Postponed (security-reviewer, low):** accounts are unverified, so anyone can register someone else's email
  (squatting). Known gap, with a rule for step 13: never auto-link a GitHub login to an existing account by email
  (pre-account hijacking).

## Interview questions
1. **Can a sign-up form avoid user enumeration?** Only with email verification: answer "check your inbox" for every
   email, and email the owner "you already have an account" instead. If sign-up logs in at once (like here), a free and a
   taken email must get different answers, so the honest 409 plus a strict rate limit is the usual trade-off.
2. **Why "at most 72 bytes", not "72 characters"?** bcrypt reads only 72 bytes. In UTF-8 a Cyrillic letter is 2 bytes and
   an emoji 4, so a 40-character password can be 160 bytes, and everything after byte 72 would be silently ignored.
3. **What does NIST say about passwords today?** SP 800-63B-4 (2025): at least 15 characters if the password is the
   only factor (8 with MFA), allow long passwords, no composition rules (they lead to `Password1!`), no forced periodic
   changes, and check new passwords against breached/common lists (not done here yet).
