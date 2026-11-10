# PR 07c: In-memory store, users repository, demo accounts

## What and why
Login (step 09) needs somewhere to keep users. This PR adds the app's "database" (plain `Map`s in memory), a users
repository that is the only code touching those Maps, and two seeded demo accounts. It is the first real use of both
earlier modules: the user's `name` is encrypted at rest with `lib/crypto`, and passwords are stored only as bcrypt
hashes from `lib/password`. Topics: S2 (authentication), S3 (data at rest).

## Changes
- `backend-express/src/app/store.ts`: `createStore()` → `users` Map, `userIdsByEmail` index, `reset()`; `UserRecord` = the stored row (with `nameEncrypted`).
- `backend-express/src/app/repositories/users.repository.ts`: `createUsersRepository(store, encryptor)` → `create`, `findById`, `findByEmail`; encrypts `name` on write, decrypts on read, normalizes emails, returns copies; `EmailTakenError`.
- `backend-express/src/app/security.ts`: the app's shared `encryptor` (from `DATA_ENCRYPTION_KEY`) and `passwords` hasher.
- `backend-express/src/app/seed.ts`: `seedDemoAccounts()`: `admin@example.com` / `Admin123!` (admin), `user@example.com` / `User1234!` (user); skips existing ones.
- `backend-express/src/app/config.ts`, `.env.example`: `SEED_DEMO_ACCOUNTS` (default on in development, off in production).
- `backend-express/src/index.ts`: creates the store and repository, seeds before the server starts listening.

## How to test
```bash
cd backend-express && node scripts/setup-env.mjs && npm run dev
```
Expected first log line: `Seeded demo accounts` with both emails. With `SEED_DEMO_ACCOUNTS=false npm run dev` that line
is missing. With `NODE_ENV=production SEED_DEMO_ACCOUNTS=true` it is a `warn`: "Seeded demo accounts with PUBLIC passwords".
No route uses the store yet; login (step 09) is the first.

## How to reuse in another project
This is app code (glue), not a portable module. The pattern carries over: one `createStore()` factory, one
repository per entity that owns all access (and encryption) for it, services that use only the repository.
```ts
const users = createUsersRepository(createStore(), encryptor);
users.create({ email, name, role: 'user', passwordHash: await passwords.hash(password) });
const user = users.findByEmail(email); // name already decrypted
```

## Verification
- `npm run typecheck` and `npm run build`: pass.
- Smoke test (temporary `DATA_ENCRYPTION_KEY` env var): dev → `Seeded demo accounts` (info); `SEED_DEMO_ACCOUNTS=false` → no seed;
  production + `true` → warn line. `/api/health` → 200 in all three.
- Repository script: second seed creates nothing; `findByEmail('  ADMIN@Example.com ')` finds the admin; the stored row has
  `nameEncrypted` (`v1....`) and no `name`; changing a returned user does not change the store; destructured
  `findByEmail` works; admin's ciphertext copied into the user's row → `DECRYPTION_FAILED`; duplicate email (other case) → `EmailTakenError`;
  `reset()` empties both Maps.

## Review
- **Fixed (code-reviewer):** a taken email threw a plain `Error`, and the comment said "callers check `findByEmail`
  first". With an `await` (hashing) between the check and `create`, two parallel registrations both pass the check and
  the second would get a 500. Now `create` throws `EmailTakenError` (`EMAIL_TAKEN`), documented as the real guard;
  step 09 maps it to the same answer as the `findByEmail` path.
- **Fixed (code-reviewer, nits):** a comment on `User` that it contains `passwordHash` (never send or log it as is),
  plus a known gap for step 09 (public user shape, `passwordHash` in the redact keys); the seed comment pointed to a README
  that does not exist yet; the older "Store and layering" decision in PROGRESS.md now matches the code.
- **Kept (security-reviewer, low):** `SEED_DEMO_ACCOUNTS=true` in production only logs a `warn` instead of refusing to
  start. Same model as `ENABLE_DEMO_ROUTES`: off by default, explicit opt-in, and step 32 (Docker, production mode) needs
  the demo accounts for a demo deployment.

## Interview questions
1. **Why encrypt a field when the disk or database is already encrypted?** Disk encryption only helps if the disk is
   stolen. A database dump, a backup copied somewhere, or an SQL injection reads the data through the running database,
   already decrypted. A field encrypted by the app stays ciphertext in all of those; only the app has the key.
2. **Why is `email` not encrypted?** Login looks users up by email. With a random IV, the same email encrypts
   differently each time, so it cannot be searched. That needs a blind index (an HMAC of the email with a second key),
   which also leaks which rows share an email. For a demo app, encrypting `name` shows the technique without that cost.
3. **What is a repository for?** It is the only code that knows how data is stored. Routes and services call
   `findByEmail`, not `Map.get`, so the storage (or its encryption) can change in one place.
