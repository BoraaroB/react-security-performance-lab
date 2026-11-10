# PR 07b: Password hashing (bcrypt)

## What and why
Passwords must never be stored in plain text or encrypted: a leaked database (or a leaked key) would expose them.
This PR adds `lib/password`, a small bcrypt wrapper that hashes with a random salt and a safe cost factor, verifies
passwords, and tells when an old hash should be upgraded. It prepares the store (07c) and login (09). Topic: S2 (authentication).

## Changes
- `backend-express/src/lib/password/hashing.ts`: `createPasswordHasher({ cost })` → `hash`, `verify`, `needsRehash`; cost limited to 10–14; passwords over 72 bytes rejected.
- `backend-express/src/lib/password/index.ts`: public API.
- `backend-express/src/lib/password/README.md`: usage, options, notes (72-byte limit, DoS, user enumeration, Argon2id).
- `backend-express/src/app/routes/demo.ts`: `GET /api/demo/password` (fixed password, 5 requests per minute).
- `backend-express/package.json`: new dependency `bcryptjs@^3.0.3` (pure JS, own types; 3.0.3 is a year old).

## How to test
```bash
cd backend-express && npm install && node scripts/setup-env.mjs && npm run dev
curl -s localhost:4000/api/demo/password
```
Expected: `first` and `second` differ (random salt), `hashMs` ≈ 200, `verifyCorrect: true`, `verifyWrong: false`,
`needsRehash: { cost12Hash: false, cost10Hash: true }`, `tooLong: "PASSWORD_TOO_LONG"`. The 6th call within a minute → 429.

## How to reuse in another project
Copy `src/lib/password/`, run `npm install bcryptjs@^3`.
```ts
const passwords = createPasswordHasher({ cost: 12 });
const passwordHash = await passwords.hash(body.password);            // register
const ok = await passwords.verify(body.password, user.passwordHash); // login
if (ok && passwords.needsRehash(user.passwordHash)) user.passwordHash = await passwords.hash(body.password);
```

## Verification
- `npm run typecheck` and `npm run build`: pass. Portability grep on `src/lib/password`: no hits.
- Smoke test (with a temporary `DATA_ENCRYPTION_KEY` env var): the demo returned the expected values, `hashMs` 208, 6th call → 429.
- Edge-case script: cost 9, 15, 12.5, NaN → `INVALID_PASSWORD_HASH_COST`; 10 and 14 work; a 73-byte password whose
  first 72 bytes match → `verify` false; malformed hashes (short, `$2x$`, `$2b$xx$`) → `verify` false, `needsRehash` true;
  a `$2b$31$` hash → `false` in 0 ms; an old cost-4 hash still verifies and `needsRehash` is true; 18 emoji (72 bytes) work, 19 → `PASSWORD_TOO_LONG`.

## Review
- **Fixed (both reviewers):** `verify` could throw for a malformed 60-character hash (bcryptjs returns `false` only
  for a wrong length), which would turn a login into a 500. Now wrapped in try/catch → `false`. Also from the security
  review: bcrypt trusts the cost stored in the hash, so `verify` now returns `false` for a cost above 14
  (a planted `$2b$31$` hash would pin the CPU). Lower costs still verify, so old hashes can be upgraded.
- **Fixed (code-reviewer, nit):** "Argon2id needs a native package" was outdated: Node 24.7+ has an experimental
  `crypto.argon2`. Reworded in the README and PROGRESS.md.

## Interview questions
1. **Why hash passwords instead of encrypting them?** Encryption can be reversed by anyone with the key; a hash cannot.
   The server only needs to check a password, never read it back.
2. **What do the salt and the cost factor protect against?** The salt (random per hash) makes equal passwords give
   different hashes and makes precomputed (rainbow) tables useless. The cost makes each guess slow, so offline
   brute force of a leaked database becomes very expensive. Each +1 in cost doubles the time.
3. **What is bcrypt's 72-byte limit, and why does it matter?** bcrypt ignores everything after 72 bytes, so two long
   passwords with the same first 72 bytes would both work. Reject longer passwords (count bytes, not characters).
