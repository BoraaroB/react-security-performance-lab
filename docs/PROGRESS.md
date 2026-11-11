# Progress

**Read this first in every new session** (e.g. after `/clear`). It is updated in every PR, so on `main` it
always describes the merged state, and on a `pr/*` branch it describes that PR.

## Current state

- **Last merged step:** 09c (current user + `/me`, PR #19)
- **In review:** 10a (`pr/10a-refresh-tokens`): `lib/refresh-tokens` (opaque tokens, SHA-256 at rest, rotation,
  reuse detection), not wired into the app yet
- **Next step:** 10b (`pr/10b-refresh-cookie`): the shared refresh-token service (glue), the refresh cookie on
  login/register, `POST /api/auth/refresh`. Then 10c (`pr/10c-logout`).

## How to resume after `/clear`

1. `git switch main && git pull`
2. Check that EVERY branch listed under "In review" (`pr/*`, `chore/*`, `fix/*`) is merged:
   `git merge-base --is-ancestor <branch> origin/main`. If unsure, ask the user.
3. Merged → run the `next-step` skill. Not merged → ask the user before doing anything else.

## Done

| # | Step | How it landed | Notes |
|---|---|---|---|
| 00 | Workflow, plan, skills | pushed directly to `main` (no PR) | `git branch -M main` was run while on the PR branch; accepted as is |
| 01 | Express skeleton | ✅ PR #1 | Added `lib/graceful-shutdown` as an extra portable module (not in the original plan) |
| 02 | Request logger | ✅ PR #2 | `lib/logger` = `core.ts` (pino + redaction) + `express.ts` (pino-http adapter) |
| – | Smaller PR budget | ✅ PR #3 (`chore/smaller-prs`) | docs only |
| 03 | Error handling | ✅ PR #4 | `lib/errors` = `core.ts` (AppError, toAppError, toErrorBody, sourceLocation) + `express.ts` (404 + error handler) |
| 04 | Validation | ✅ PR #5 | `lib/validation` = `core.ts` (`validateRequest`) + `express.ts` (`validate()`); demo routes `/api/demo/validation` |
| – | Demo routes flag | ✅ PR #7 (`fix/demo-routes-flag`) | `/api/demo/*` only with `ENABLE_DEMO_ROUTES` |
| – | Review agents | ✅ PR #6 (`chore/review-agents`) | `code-reviewer` + `security-reviewer`, `.env` read deny, plan additions |
| 04b | Process errors | ✅ PR #8 | `uncaughtException` / `unhandledRejection` → fatal log, graceful shutdown, exit 1 |
| 05a | Security headers | ✅ PR #9 | `lib/security/headers.ts` (`securityHeaders()`, helmet); `express.json({ limit: '32kb' })` |
| 05b | CORS | ✅ PR #10 | `lib/security/cors.ts` (`corsPolicy()`, `isExactOrigin()`); `CORS_ORIGINS` in config |
| 06 | Rate limiting | ✅ PR #11 | `lib/rate-limit` (`rateLimit()`, express-rate-limit); `TRUST_PROXY`; global 300/15 min |
| 07a | Encryption | ✅ PR #12 | `lib/crypto` (`createEncryptor`, `parseEncryptionKey`); `DATA_ENCRYPTION_KEY`; `scripts/setup-env.mjs` |
| 07b | Password hashing | ✅ PR #13 | `lib/password` (`createPasswordHasher` → `hash`, `verify`, `needsRehash`); `bcryptjs` |
| 07c | Store + seed | ✅ PR #14 | `store.ts`, `repositories/users.repository.ts`, `security.ts`, `seed.ts`; `SEED_DEMO_ACCOUNTS`; posts deferred to step 12 |
| 08 | JWT access token | ✅ PR #15 | `lib/jwt` (`createAccessTokenService` → `sign`, `verify`; `authenticate`); `JWT_SECRET`; demo `/api/demo/jwt`. Merged with `role` in the token |
| – | Token = user ID only | ✅ PR #16 (`fix/jwt-sub-only`) | Removes `role` from the token (user's decision). Pushed after PR #15 was merged, so it needed its own PR |
| 09a | Login | ✅ PR #17 | `auth.schemas.ts`, `auth.service.ts`, `auth.controller.ts`, `auth.routes.ts`; `createApp({ users })`; `accessTokens` glue |
| 09b | Register | ✅ PR #18 | `registerSchema`, `register()` → 201, 409 `EMAIL_TAKEN`, register limiter 5/hour |
| 09c | Current user + `/me` | ✅ PR #19 | `middleware/current-user.middleware.ts` (`loadCurrentUser`), `requireUser` chain in `app.ts`, `GET /api/auth/me` |
| 10a | Refresh tokens (core) | 🔍 `pr/10a-refresh-tokens` | `lib/refresh-tokens` (`createRefreshTokenService` → `issue`, `rotate`; `createMemoryRefreshTokenStore`); no HTTP yet |

## Decisions (and why)

- **Pinned majors:** Vite 7, TypeScript 5.9, NestJS 11, React Router 7. The newest majors (Vite 8, TS 7, Nest 12, RR 8) were too new to rely on.
- **Logger:** pino over winston: faster, built-in redaction of secrets, `pino-http` for request logs.
- **Git flow:** Claude creates the branch and commits locally. The user pushes, opens the PR, and merges.
- **Automatic review (added after PR 04):** before every commit, `next-step` runs two read-only agents in parallel,
  `code-reviewer` and `security-reviewer` (`.claude/agents/`), on the staged diff. Claude checks each finding, fixes the valid
  ones, and lists the outcome in a `## Review` section of the PR description. They do not replace the user's own review.
- **No `.env` access for Claude Code (user's decision):** `.claude/settings.json` denies `Read` on `.env`, `.env.local`,
  `.env.*.local`, `.env.development`, `.env.production`, `.env.test` in every folder. `.env.example` stays readable.
  Applies to the main session and to subagents (reviewers).
- **Plan additions (after PR 04):** step 04b (process-level error handlers), `trust proxy` in step 06, and Phase E
  (backend ESLint, tests, CI with `npm audit`). Tests are at the end on purpose (the user's choice).
- **No AI attribution** in commits or PR descriptions.
- **Language:** everything in the repo is English; chat with the user is in Serbian.
- **Dependencies per step:** each PR adds only the npm packages it uses.
- **PR size (changed 2026-11-10, after PR 02):** ~150 lines of code per PR (was ~300), one new concept per PR. PR 02 (~250 lines of code) was too hard to follow. Bigger plan steps are split into `NNa`, `NNb`, ...
- **Docker:** added as Phase D (steps 31–32) at the end of the plan. Local development stays without Docker; logs go to stdout (no log files), which is what Docker expects.
- **pino 10 / pino-http 11 / pino-pretty 13:** `pino-pretty` is a dev dependency; it is loaded only when `pretty: true` (non-production).
- **Request ID:** a new UUID per request by default. An incoming `X-Request-Id` is reused only with
  `trustIncomingRequestId: true` (behind a trusted proxy) and only if it matches `^[\w-]{1,64}$` (no log injection).
- **Request log shape:** `req.log` is a child logger with only `reqId` (`quietReqLogger`), so handler logs stay short.
  The request line logs the path without the query string; `query` and `body` are logged only when `logPayloads` is on (dev).
- **Error handling (step 03):** `AppError(status, code, message, { details?, cause? })`; its message is always safe for the client.
  Library client errors that follow `http-errors` (`status` 4xx + `expose: true`, e.g. invalid JSON from `express.json()`)
  keep their status with a generic message and a code from the status text (`BAD_REQUEST`, `PAYLOAD_TOO_LARGE`).
  The parser's own message is never sent or logged, because newer Node versions echo part of the body (it could hold a password).
  Everything else → 500 `INTERNAL_ERROR`. The 404 message does not echo the path.
- **Error logs:** the error handler logs through `req.log` (so lines carry `reqId`): 4xx → one `warn` line `CODE: message`;
  5xx → `error` with `err` (stack) and `source` (`file:line:col`, first frame outside `node_modules`).
  The pino-http request line no longer has `err`: for 5xx it only had a made-up "failed with status code 500" error.
- **Validation (step 04):** `validate({ params?, query?, body? })`. `lib/validation` depends on `lib/errors` (throws `AppError`).
  Errors of all parts are collected into one `VALIDATION_ERROR`. `details[].field` is the path inside its part (`title`),
  or the part name (`body`) when the whole part is wrong; there is no `body.` prefix, so the frontend can map it to form fields.
  Unknown keys are stripped (`z.object`), not rejected. A part without a schema is typed `unknown` in the handler.
  Express 5 `req.query` has only a getter, so the parsed query is set with `Object.defineProperty` on the request.
- **Demo routes:** `/api/demo/validation` (POST body, GET query) is not in the API contract; it exists to try validation
  with curl. All `/api/demo/*` routes are mounted only when `ENABLE_DEMO_ROUTES` is on (default: on in development,
  off in production), because demo routes are extra attack surface. Docker (step 32) can turn them on explicitly.
- **Crash handling (step 04b):** lives in `lib/graceful-shutdown` (option `handleProcessErrors`, default on), not in a new
  module, because it must end in the same shutdown. `uncaughtException` / `unhandledRejection` → `logger.fatal` with the
  stack → graceful shutdown → exit 1. The exit code is sticky and also set as `process.exitCode`: a crash during a SIGTERM
  shutdown, or cleanup that hangs, still exits 1. The force-exit timer is armed before any logging.
  `src/index.ts` also handles the Express 5 `app.listen` error (EADDRINUSE) → fatal log, exit 1.
  No demo route crashes the server on purpose (it would be a DoS button); it is tested with a temporary script.
- **Step 05 split (user's choice):** 05a = helmet + body limit, 05b = CORS. One concept per PR.
- **Security headers (step 05a):** `lib/security` has no `express.ts` adapter: helmet middleware uses plain Node `req`/`res`,
  so `securityHeaders()` works in Express and Nest as is. The policy is for an API only: CSP `default-src 'none';
  frame-ancestors 'none'` (helmet's default CSP is for HTML sites), `X-Frame-Options: DENY`; the rest are helmet defaults
  (HSTS 1 year + `includeSubDomains`, nosniff, CORP `same-origin`, `Referrer-Policy: no-referrer`). No options on purpose:
  an HTML server should use helmet directly. Mounted right after the request logger, so 404/413/500 responses get the headers too.
  `app.disable('x-powered-by')` stays (helmet removes the header too; harmless).
- **Body limit (step 05a):** `express.json({ limit: '32kb' })` in `app.ts` (glue, not a module): fits a 10,000-character
  post even with multi-byte UTF-8. Too big → 413 `PAYLOAD_TOO_LARGE` from the existing error handler.
- **CORS (step 05b):** `corsPolicy()` wraps the `cors` package (also plain Node `req`/`res`, so Nest uses `app.use`
  instead of `app.enableCors()`). Origins are an exact-string allowlist, validated at startup by `isExactOrigin()`
  (no `*`, `null`, regex, path, trailing slash); the config validates `CORS_ORIGINS` with the same function for a clear error.
  `origin` is always passed as an array: in the cors package a missing `origin` key means `*`, `true` reflects every
  origin, and `''`/`false` skip CORS. `CORS_ORIGINS` must not be empty (remove it to get the default) and must be
  `https://` in production (except `localhost`).
  Default origins: `http://localhost:5173` in dev, `[]` in production. `credentials: true` (refresh cookie, step 10).
  Fixed `allowedHeaders` (`Content-Type`, `Authorization`) instead of echoing the browser's request; `exposedHeaders`:
  `X-Request-Id`. `Access-Control-Max-Age: 600`. A disallowed origin is not rejected with 403: it simply gets no
  `Access-Control-Allow-Origin`, and CSRF (step 11) protects writes. Mounted after `securityHeaders`, before `express.json`,
  so preflights are answered early and error responses carry CORS headers.
- **Rate limiting (step 06):** `lib/rate-limit` is an Express adapter only (`express.ts`, no `core.ts`): express-rate-limit
  is Express middleware, and Nest uses `@nestjs/throttler` (step 27). It depends on `lib/errors`: the 429 is
  `AppError(429, 'RATE_LIMITED')` passed to `next()`, so it has the normal JSON shape and a `warn` log line.
  The library sets `Retry-After` before calling the handler. Headers: IETF `standardHeaders: 'draft-8'` (`RateLimit`,
  `RateLimit-Policy`), no legacy `X-RateLimit-*`. Key: `req.ip`, IPv6 grouped by /56 (library default). Memory store per
  process (optional `store` option for Redis). Global limiter: 300 requests / 15 min per IP, after CORS (preflights
  not counted) and before `express.json` (blocked requests are not parsed). `/api/health` is not excluded.
  Demo: `GET /api/demo/rate-limit`, 5 per minute. Option `logger` (pino-style `(obj, msg)`): the library's setup warnings
  go to the app's pino logger instead of `console`. pino methods must be called as methods (`logger.warn(...)`):
  passed as a bare function they lose `this` and throw, which turned a request into a 500 during testing. CORS `exposedHeaders` now also has `Retry-After`, `RateLimit`, `RateLimit-Policy`.
- **Auth limiter moved to step 09 (deviation from the plan row):** login/register do not exist yet, and the plan has no
  unused code for future steps. Step 09 adds `rateLimit(...)` directly on `POST /login` and `/register`
  (not on all of `/api/auth`: `/me`, `/csrf`, and `/refresh` must not share the strict limit).
- **`TRUST_PROXY` (step 06, deviation: one variable instead of `TRUST_PROXY_HOPS`):** a hop count `0`–`10` or a
  comma-separated list of IPs, CIDRs, or Express names (`loopback`, `linklocal`, `uniquelocal`). Default `0`, which is
  passed to Express as `false` (its default), so express-rate-limit's one-time check can warn about `X-Forwarded-For`
  without a trusted proxy. `true`, more than 10 hops, bad IPs/CIDRs, and an empty value fail at startup.
  CIDR prefixes must be at least /8 (IPv4) and /32 (IPv6): `0.0.0.0/0` would trust every client, the same as `true`
  (found in review). Wider private ranges go through the names (`uniquelocal` covers `fc00::/7`).
- **New dependency versions:** `express-rate-limit` locked to 8.7.1 (a month old); 8.7.4 was published the day before.
  Rule of thumb from now on: avoid npm versions published in the last ~2 weeks (supply-chain risk).
- **Step 07 split (user's choice):** 07a = `lib/crypto` + `setup-env.mjs`, 07b = `lib/password` (bcrypt),
  07c = in-memory store + seed. The store is in memory (`Map`s in the process), not a real database, as planned.
  Open question for 07c: which field is encrypted at rest (e.g. the user's `name`, or `email` with a blind index).
- **Encryption (step 07a):** `lib/crypto` uses only `node:crypto`, no adapter (no framework code). AES-256-GCM, a random
  12-byte IV per value, full 16-byte tag (`authTagLength` on decipher, so a shortened tag is rejected). Output
  `v1.<iv>.<tag>.<ciphertext>` (base64url); `v1` leaves room for key rotation later. Optional `context` = GCM associated
  data (e.g. the owner's user ID): a value copied to another row fails to decrypt. Every decrypt failure is one
  `DecryptionError` (`DECRYPTION_FAILED`). `parseEncryptionKey` accepts only canonical base64 of exactly 32 bytes (Node's
  decoder silently skips bad characters). Recommended context: table + column + row ID (`users.name:${id}`), so values
  cannot be swapped between rows or between encrypted columns. The app's shared encryptor (glue) is created in 07c,
  where it is first used; in 07a only the config validates the key.
- **`DATA_ENCRYPTION_KEY` (step 07a):** required in every environment, no default (a key in the code is no secret).
  A missing, empty, or bad key stops the server at startup with a hint to run `node scripts/setup-env.mjs`.
- **`scripts/setup-env.mjs` (step 07a):** creates `.env` from `.env.example` if missing, fills only EMPTY secrets with
  `crypto.randomBytes` (never `Math.random`), never changes an existing value (a new key would make old data unreadable),
  never prints values. It sets mode 600 BEFORE writing a secret, writes a temp file and renames it over `.env`
  (a crash cannot truncate `.env` and lose a key), and writes nothing when nothing changed. It also recognizes
  `export NAME=` / `NAME = value` (otherwise it would append a second, different key) and treats `NAME=""` as empty.
  Secrets are listed per project in the script.
- **Crypto demo (step 07a):** `GET /api/demo/crypto` encrypts a FIXED text, never the caller's input (an "encrypt
  anything" endpoint would let anyone use the server's key), with its OWN random key, never `DATA_ENCRYPTION_KEY`
  (a public route must not hand out ciphertexts the real key accepts). Shows random IVs, tamper detection, wrong context.
- **Password hashing (step 07b):** `lib/password` wraps `bcryptjs` 3 (pure JS, no native build, own types), no adapter.
  `createPasswordHasher({ cost })`: default 12 (≈ 200 ms per hash), allowed 10–14 (below 10 is too fast, above 14 makes
  login a DoS lever; a huge cost would never finish), anything else throws `PasswordHasherConfigError` at startup.
  bcrypt silently ignores bytes after 72, so `hash` throws `PasswordTooLongError` (`PASSWORD_TOO_LONG`) and `verify`
  returns `false` for longer passwords; `MAX_PASSWORD_BYTES` is exported for the step 09 Zod schema (count UTF-8 bytes).
  `verify` never throws: a malformed hash gives `false` (bcryptjs rejects a malformed 60-character hash, so `compare` is
  wrapped in try/catch; found in review), and so does a stored hash with a cost above 14 (bcrypt trusts the cost in the
  hash, so a planted `$2b$31$` hash would pin the CPU). Lower costs still verify, so old hashes can be upgraded. `needsRehash` (`getRounds !== cost`) lets login upgrade
  old hashes. Argon2id (OWASP's first choice) was not used: it needs a native npm package or Node's
  still-experimental `crypto.argon2` (Node 24.7+); bcryptjs is pure JS, stable, and works the same in the Nest copy. The shared hasher (glue) is
  created in 07c, where it is first used.
- **Password demo (step 07b):** `GET /api/demo/password` hashes a FIXED password (never the caller's input) with its
  own hasher, 5 requests per minute: one response costs ~1 s of CPU, so an open "hash anything" route would be a DoS button.
- **Store and layering (decided before 07b, for 07c on):** the store is plain `Map`s in memory, as planned (SQLite and
  Postgres were discussed and declined): a `createStore()` factory with `reset()`, `randomUUID()` IDs, and an email → id
  index for login (what was actually built: see "Store and users repository (step 07c)" below). New features use routes → controllers → services → repositories:
  routes = URL + middleware (validate, auth, rate limit); controllers = `req`/`res` only; services = business logic
  (password check, ownership); repositories = entity type + data access over the `Map`s, one file each
  (`repositories/users.repository.ts` with `interface User` + `createUsersRepository(store, encryptor)`). Folder `repositories/`,
  not `models/` ("model" is ambiguous, e.g. Mongoose; Nest uses the same terms). Layout:
  `src/app/{routes,controllers,services,repositories}/` + `src/app/store.ts`, files `<name>.<layer>.ts`. Routes never
  touch a `Map`, so the store could later be swapped (e.g. SQLite) without touching routes. The existing `health` and
  `demo` routes stay as they are (no drive-by refactor).
- **Store and users repository (step 07c):** `UserRecord` (in `store.ts`) is the stored row: `id` (`randomUUID`),
  `email` (normalized: trimmed + lowercase, plain text), `nameEncrypted`, `passwordHash`, `role` (`user` | `admin`),
  `createdAt`. `User` (in the repository) is what the app sees: `name` decrypted, everything else the same (including
  `passwordHash`, so a `User` is never sent or logged as it is).
  `userIdsByEmail` is a second Map used as an index for login. `structuredClone` on reads was not needed: rows are flat,
  and `toUser` always returns a new object. `create` throws `EmailTakenError` (`EMAIL_TAKEN`) for a taken email. That
  check is the real guard (found in review): register does `findByEmail` → `await hash` → `create`, so two parallel
  registrations can both pass `findByEmail`. Step 09 catches `EmailTakenError` and answers exactly like the
  `findByEmail` path (no 500, no user-enumeration difference). No `this` inside repository methods
  (breaks when destructured, the same trap as pino in step 06).
- **Encrypted at rest: `name` only (user's choice, 07c):** context `users.name:${id}`. `email` stays plain text, because
  login looks it up; encrypting it would need a blind index (HMAC + a second key) and a second concept in one PR.
  A blind index can be a separate small step later if wanted. It is also a good interview question.
- **Shared encryptor and hasher (07c):** `src/app/security.ts` (glue, like `logger.ts`), default bcrypt cost 12.
- **Seeding (07c):** `SEED_DEMO_ACCOUNTS` (stringbool), default on in development and off in production: the demo
  passwords are public, so on a real server those accounts would be open doors. Turned on in production, the seed log
  line is a `warn`. Runs with top-level `await` in `index.ts` before `listen` (two hashes, ~400 ms at startup).
  Idempotent: existing emails are skipped.
- **Posts deferred to step 12 (deviation from the 07c plan row):** no code for future steps; the posts Map and
  repository come with posts CRUD. Wiring the repository into `createApp()` (dependency injection) comes in step 09,
  the first route that uses it.
- **JWT access tokens (step 08):** `lib/jwt` = `core.ts` (`createAccessTokenService`) + `express.ts` (`authenticate`),
  `jsonwebtoken` 9. HS256 only, fixed in the code (not an option): signed and verified with `algorithms: ['HS256']`, so
  `alg: none` and algorithm confusion are rejected. `verify` checks `iss` and `aud` and also requires `exp` (jsonwebtoken
  does not). Claims: only `sub` (user ID); the payload is readable by anyone. TTL default 900 s,
  allowed 1–3600. Secret ≥ 32 bytes. `InvalidTokenError` has `TOKEN_EXPIRED` or `TOKEN_INVALID`; the library's reason is
  never sent. `authenticate` reads only `Authorization: Bearer` (never a cookie), sets `req.auth` (global `Express.Request`
  augmentation), and answers 401 `TOKEN_EXPIRED` (frontend refreshes) or `UNAUTHORIZED` with `WWW-Authenticate: Bearer`.
  `lib/jwt/express.ts` depends on `lib/errors`.
- **No role in the token (user's decision, step 08):** the token carries only `sub`. A role in the token would be a
  snapshot from login, so a demoted admin or a deleted user would keep access for up to 15 minutes. Instead the app
  loads the current user by `sub` on every protected request (one primary-key lookup; in a monolith that is cheap and
  the usual choice). Step 09 adds that as app glue (e.g. `loadCurrentUser(users)` → `req.user`, a missing user → 401
  `UNAUTHORIZED`), not in `lib/jwt`, so the module stays free of the store. Step 12 (`authorize`) reads the role from
  `req.user`, never from the token. Industry note: microservices behind an identity provider usually put roles/scopes
  in a short-lived token (RFC 9068), because they cannot reach the user database.
- **`JWT_SECRET` (step 08):** required, no default, ≥ 32 characters; `setup-env.mjs` generates 32 random bytes (base64url).
  Its own value, never `DATA_ENCRYPTION_KEY` (one key per purpose). Issuer `react-security-lab-api` and audience
  `react-security-lab-web` are fixed in the glue. Following 07a/07b, the shared `accessTokens` instance (glue in
  `security.ts`) is created in step 09, where it is first used; in step 08 only the config validates the secret.
- **JWT demo (step 08):** `GET /api/demo/jwt` and `/api/demo/jwt/protected` use their own random secret and a 60 s TTL,
  never `JWT_SECRET` (a public route must not hand out tokens the real API accepts).
- **Step 09 split (user's choice):** 09a = login, 09b = register, 09c = `loadCurrentUser` + `GET /auth/me`. One concept per PR.
- **Login (step 09a):** `createAuthService({ users, passwords, accessTokens })` in `src/app/services/`. An unknown email
  runs `verify` against a dummy hash (a random UUID hashed once at startup with the same hasher, so the same cost),
  so it takes as long as a wrong password (measured: 0.198 s vs 0.200 s). Both answer 401 `INVALID_CREDENTIALS`
  "Invalid email or password". The service throws `AppError` (framework-free, from `lib/errors/core`); the controller
  only maps request → service → JSON. After a successful login, `needsRehash` → `users.updatePasswordHash` (new hash at
  the current cost). Response: `{ accessToken, user }`, `user` = `toPublicUser()` (allowlist `id`, `email`, `name`, `role`).
  The refresh cookie comes in step 10.
- **Request schemas (step 09a, new folder):** `src/app/schemas/<name>.schemas.ts` (Zod body schemas + their types).
  Not in the controller (routes and controller both need them) and not in the routes (the controller imports the type).
  Login: email `trim` → `z.email()` → max 254; password 1–72 characters (a longer one can never match a bcrypt hash,
  and bcrypt is not run for it). The format check gives the frontend field errors; it reveals nothing about accounts.
- **Auth routes (step 09a):** `createAuthRouter(auth)` sets `Cache-Control: no-store` on every response from the auth
  router (first middleware, so errors inside it get it too). Responses produced before the router (global 429, malformed
  JSON 400, 413) do not get it; they carry no tokens or user data. Login limiter: 10 requests / 15 min per IP, counts successful logins too,
  created inside the router factory. Register (09b) gets its own limiter instance (separate counter).
- **Dependency injection (step 09a):** `createApp({ users })`: `index.ts` creates the store and repository (it already
  needed them for seeding) and passes them in. The auth service is built inside `createApp` from the shared
  `passwords` and `accessTokens` (`security.ts`).
- **`passwordHash` redacted (step 09a):** added in `src/app/logger.ts` via `redactKeys` (glue, not a `lib/logger` change).
- **Register (step 09b):** 201 `{ accessToken, user }` (logged in at once; the refresh cookie comes in step 10).
  A taken email → 409 `EMAIL_TAKEN` "An account with this email already exists" (new error code). This reveals that the
  account exists; that cannot be hidden while sign-up logs in at once (a free email gets 201). Hiding it would need an
  email-verification flow (same "check your inbox" answer for both cases), which is out of scope. The strict limiter is
  the mitigation. Order: `findByEmail` fast path (no bcrypt, ~1 ms) → hash → `create`; `create`'s `EmailTakenError`
  (two parallel sign-ups) → the same 409. The role is always `'user'`, set in the service; `registerSchema` has no
  `role` field, so a sent `role` is stripped.
- **Password rules (step 09b):** NIST SP 800-63B-4 (2025): at least 15 characters (the password is the only factor;
  8 would be allowed only with MFA), counted as Unicode code points (`[...value].length`, not `.length`), no composition
  rules, at most 72 UTF-8 bytes (`Buffer.byteLength`), so `PasswordTooLongError` cannot happen after validation.
  The seeded demo passwords (`Admin123!`, `User1234!`) are shorter; they bypass the schema and are only for local demos.
  Name: trimmed, NFC-normalized, 1–100, no control or format characters (`\p{Cc}`, `\p{Cf}`: zero-width space,
  right-to-left override), against spoofing; emoji with a zero-width joiner are rejected too (accepted).
  `email` is one shared Zod field for login and register.
- **Register limiter (step 09b):** 5 requests per hour per IP, its own counter (a fresh user must still be able to log
  in). Invalid requests count too. Per IP, so people behind one shared IP (office, school, mobile carrier) share the 5:
  accepted trade-off. Not `skipFailedRequests`: it would also skip the 409s and allow mass email probing.
- **Current user (step 09c):** `loadCurrentUser(users)` in `src/app/middleware/` (new folder, files
  `<name>.middleware.ts`): app glue, not in `lib/jwt`, so the module stays free of the store. Runs after `authenticate`,
  loads the user by `req.auth.sub` on every protected request, and sets `req.user` = `PublicUser` (global
  `Express.Request` augmentation in the same file). The public shape on purpose: no `passwordHash` on the request, so
  `res.json(req.user)` or a log line cannot leak it. A missing user → 401 `UNAUTHORIZED` "Authentication required"
  + `WWW-Authenticate: Bearer` (same as a missing token; the frontend logs in again). No `req.auth` (wiring mistake) →
  500, fail closed; the `me` handler also throws (500) if `req.user` is missing. `app.ts` builds
  `requireUser = [authenticate(accessTokens), loadCurrentUser(users)]` once and passes it to routers
  (`createAuthRouter({ auth, requireUser })`); step 12 passes the same chain to the posts and admin routers.
  `GET /api/auth/me` → `{ user }`, global limiter only (the frontend calls it on every page load), `no-store` from the router.
- **Step 10 split (user's choice):** 10a = `lib/refresh-tokens` core (no HTTP), 10b = refresh cookie on
  login/register + `POST /auth/refresh`, 10c = `POST /auth/logout`. One concept per PR.
- **Refresh tokens (step 10a):** `lib/refresh-tokens` uses only `node:crypto`, no adapter. Opaque, not a JWT (it must
  be revocable, so the server looks it up anyway): 32 random bytes, base64url (always 43 characters; anything else is
  rejected before the store). Stored only as SHA-256 hex (`tokenHash`); a fast hash is fine for 256 random bits.
  Record: `tokenHash`, `userId`, `familyId` (one per login, `randomUUID`), `expiresAt`, `familyExpiresAt`, `usedAt`.
  `issue(userId)` starts a family; `rotate(token)` uses the token up and returns a new one in the same family.
  Errors: `RefreshTokenError` `REFRESH_TOKEN_INVALID` (unknown, expired, malformed) or `REFRESH_TOKEN_REUSED` (already
  used → `deleteFamily`, so the thief's newer token dies too; a later replay of the same token is then just `INVALID`).
  Expiry: sliding `ttlSeconds` (default 7 days) per token, capped by `absoluteTtlSeconds` (default 30 days) per family,
  so daily refreshing cannot keep a session alive forever. `RefreshTokenStore` is async (`save`, `find`, `markUsed`,
  `deleteFamily`), so a database or Redis can implement it. `markUsed` is an atomic compare-and-set (used only if
  `usedAt` is still `null`). After saving the new token, `rotate` checks that the used token is still stored:
  `deleteFamily` removes used records too, so if it is gone, a parallel request revoked the family while the new token
  was being saved (possible with a real database), and `rotate` revokes again and throws `REUSED` (found in review).
  Result: two parallel rotations of one token → BOTH get `REUSED` and the family is revoked (checked with a temporary
  script, also with a slow store; no test file yet). The "already used?" check runs BEFORE the expiry check (found in
  review): a user who comes back after their old token expired still triggers reuse detection. So used records must be
  kept until `familyExpiresAt`, not `expiresAt`. `absoluteTtlSeconds` is at most 1 year (catches config typos).
  The module ships `createMemoryRefreshTokenStore()` (a `Map` with `clear()`); whether 10b uses it or a repository over
  `store.ts` (so `store.reset()` clears tokens too) is decided in 10b. No `revoke` yet: logout adds it in 10c.
- **Redaction:** by exact key name, top level and up to 3 levels deep (`DEFAULT_REDACT_KEYS` in `lib/logger/core.ts`).
  Headers are not logged at all, but `authorization`/`cookie`/`set-cookie` are still redacted as a safety net.

## Local state that is not in git

- `backend-express/.env` exists locally (git-ignored). It needs `DATA_ENCRYPTION_KEY` (07a) and `JWT_SECRET` (08):
  run `node scripts/setup-env.mjs` (it fills empty secrets and keeps everything else).
- Nothing else: `frontend/`, `backend-nest/`, and the root `package.json` were deleted on purpose.
  Each step creates its own files from scratch (frontend in step 14, Nest in step 26, root scripts in step 30).

## Known gaps (fixed in later steps)

- **CORS header lists (05b):** step 11 must add the CSRF header (e.g. `X-CSRF-Token`) to `allowedHeaders` in `app.ts`,
  or the browser blocks it for the frontend. (`Retry-After` and `RateLimit` were added to `exposedHeaders` in step 06.)
- **Rate limit store (06):** in memory, per process. Several instances (or Docker replicas) would each count separately
  and a restart resets the counters. A Redis store is out of scope; mention it in the README of step 30/31.
- **Rate-limit setup checks (06):** express-rate-limit runs each check (e.g. `X-Forwarded-For` without trusted proxy)
  only on the FIRST request a limiter sees, so they catch setup mistakes, not attacks. Accepted.
- **Keep-alive during shutdown (found in 04b review):** after `server.close()`, a client with an already open keep-alive
  connection can keep sending requests and they are still served until the force-exit timeout (10 s). Applies to SIGTERM
  and to crashes. Fix idea: send `Connection: close` on every response once shutdown starts. Small side PR or with Docker (step 31).
- No route throws a 500 yet, so the 500 path was only tested with a temporary script (see `docs/prs/03-error-handling.md`).
- The request log line shows the body/query AFTER validation (it is written when the response finishes),
  so stripped fields (e.g. an attempted `role: "admin"`) are not visible in the log. Accepted for now.
- No automated tests yet; verification is typecheck + build + curl smoke tests + review agents → Phase E (steps 33–35).
- Shell commands (`cat .env`) are not covered by the `Read(...)` deny rules in `.claude/settings.json`; only Claude Code's
  built-in file tools are. Full coverage would need Claude Code's Bash sandbox (not enabled; the user decides).
- **JSON limit vs post size (found in 05a review):** the 32 kb limit in `app.ts` assumes post content ≤ 10,000 characters.
  Step 12 must keep that limit in its Zod schema, or raise the JSON limit; otherwise valid posts get 413 instead of `VALIDATION_ERROR`.
- `Cache-Control: no-store` is set only on `/api/auth/*` (09a). Other routes with user data (posts, admin, step 12)
  should get it too.
- **Key rotation (07a):** not supported. Changing `DATA_ENCRYPTION_KEY` makes all encrypted values unreadable (with an
  in-memory store that only matters within one run). The `v1.` prefix leaves room for a key ID later.
- **Encrypted values are not searchable (07a):** a random IV means `encrypt(x)` differs every time, so lookups by an
  encrypted field need a blind index (HMAC). Decided in 07c: `email` stays plain text, only `name` is encrypted.
- **bcrypt CPU on the main thread (07b):** `bcryptjs` async hashing yields between chunks, but it still uses the main
  thread's CPU. Many parallel logins slow every request; the strict login limiter (09a) is the mitigation. It is per IP, so a
  botnet with many IPs is not stopped; per-account throttling or lockout is not planned (lockout lets anyone lock out a victim).
- **JWT key rotation (08):** one secret, no `kid`. Changing `JWT_SECRET` invalidates every access token at once
  (users must refresh; harmless with 15 min tokens). Several services would need RS256/EdDSA with public keys.
- **Access tokens cannot be revoked (08):** a stolen token works until it expires (≤ 15 min). Logout/reuse detection
  in step 10 revoke only the refresh token. A deny-list would make JWTs stateful; not planned.
- **Login and register have no CSRF check yet (09a/09b → step 11):** the API contract and the security rules require one. The risk is
  low today (`express.json` ignores form bodies, and a cross-site JSON POST needs a CORS preflight), but once step 10
  sets the refresh cookie, login CSRF (logging the victim into the attacker's account) becomes real. Login CSRF needs a
  pre-session token from `GET /auth/csrf`.
- **Dummy hash vs older costs (09a):** the dummy hash uses the CURRENT bcrypt cost. After the cost is raised, accounts
  that still have an older (cheaper) hash answer a wrong password faster than an unknown email, so they can be told
  apart until their next login upgrades the hash. Not reachable today (in-memory store, every hash at cost 12).
- **No client IP on failed logins (09a, low):** failed logins and login 429s are logged without `req.ip`, so operators
  cannot see which IPs are attacking. Fix idea: `ip: req.ip` in the request log, or one auth-failure line with the IP
  (never the password). Small side PR later.
- **No breached/common-password check (09b):** NIST requires rejecting passwords from breach and common-password
  lists (a bundled top-10k list, or the HIBP k-anonymity API), and a password equal to the email is not rejected either.
  Not planned yet (a separate concept); a good interview topic.
- **Register reveals taken emails (09b):** 409 `EMAIL_TAKEN` (see Decisions). Only email verification would hide it.
- **No email verification (09b):** anyone can register with someone else's email address (squatting: the owner can
  never sign up). **Rule for step 13 (OAuth):** never auto-link a GitHub identity to an existing local account by
  matching email, or an attacker who pre-registered that email keeps a password into the victim's account
  (pre-account hijacking).
- **Refresh-token records are never pruned (10a):** the memory store keeps used and expired records until restart
  (used ones are needed for reuse detection until they expire), and `deleteFamily` scans every record. Fine for a demo;
  a sweep (an `.unref()` timer) or a database with a TTL index would fix it.
- **Two tabs refreshing at once look like reuse (10a):** both send the same token, both get `REUSED`, and the
  family is revoked (logout). Step 21 must send one refresh at a time (single-flight). No grace period on purpose.
- **For 10b (from the 10a security review):** (1) answer `REFRESH_TOKEN_REUSED` and `REFRESH_TOKEN_INVALID` with the
  same 401 body (a thief should not learn that a token was real or that the theft was detected); log `REUSED` on the
  server as a security event with `userId`, `familyId`, request ID, never the token or its hash. (2) After `rotate`,
  load the user by `userId`; a missing user → revoke the family and 401 (like `loadCurrentUser`), or a deleted account's
  refresh token keeps minting access tokens for up to 30 days. (3) Cookie `expires` from `issued.expiresAt`; only the
  raw cookie value reaches `rotate`.
- **For 10c and later (from the 10a security review):** `revoke(token)` = hash → `find` → `deleteFamily`, and it must
  not throw for an unknown or used token (logout stays idempotent and reveals nothing). There is no "revoke every
  family of a user" (`deleteByUser`) yet; a password change or "log out everywhere" needs it.
- npm 11 prints "allow-scripts" warnings on install; `tsx` works without approving any scripts.
