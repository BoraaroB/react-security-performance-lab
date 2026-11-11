# Progress

**Read this first in every new session** (e.g. after `/clear`). It is updated in every PR, so on `main` it
always describes the merged state, and on a `pr/*` branch it describes that PR.

## Current state

- **Last merged step:** 07c (in-memory store, users repository, demo accounts, PR #14)
- **In review:** 08 (`pr/08-jwt-access-token`): `lib/jwt` (access tokens: HS256 pinned, iss/aud, 15 min), `authenticate` middleware, `JWT_SECRET`
- **Next step:** 09 (`pr/09-register-login`): register, login, `GET /auth/me`, user-enumeration protection, strict login limiter, load the current user by the token's `sub`.
  Probably too big for one PR: propose a 09a/09b split (e.g. register/login vs. `loadCurrentUser` + `/auth/me`)

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
| 08 | JWT access token | 🔍 `pr/08-jwt-access-token` | `lib/jwt` (`createAccessTokenService` → `sign`, `verify`; `authenticate`); token = `sub` only, no role; `JWT_SECRET`; demo `/api/demo/jwt` |

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
- No `Cache-Control: no-store` on API responses yet (helmet does not set it). Responses with tokens or user data
  should not be cached by the browser or proxies → add it with the auth routes (steps 09–10).
- **Key rotation (07a):** not supported. Changing `DATA_ENCRYPTION_KEY` makes all encrypted values unreadable (with an
  in-memory store that only matters within one run). The `v1.` prefix leaves room for a key ID later.
- **Encrypted values are not searchable (07a):** a random IV means `encrypt(x)` differs every time, so lookups by an
  encrypted field need a blind index (HMAC). Decided in 07c: `email` stays plain text, only `name` is encrypted.
- **Public user shape (07c → step 09):** `User` contains `passwordHash`, and the logger does not redact that key.
  Step 09 must map users to a public shape (`id`, `email`, `name`, `role`) before `res.json`, and should add
  `passwordHash` to the redact keys as a safety net.
- **User enumeration timing (07b → step 09):** login must run `verify` against a dummy hash when the email does not
  exist, or the faster response reveals which accounts exist. Not in `lib/password` yet; step 09 adds it.
- **bcrypt CPU on the main thread (07b):** `bcryptjs` async hashing yields between chunks, but it still uses the main
  thread's CPU. Many parallel logins slow every request; the strict login limiter (step 09) is the mitigation.
- **JWT key rotation (08):** one secret, no `kid`. Changing `JWT_SECRET` invalidates every access token at once
  (users must refresh; harmless with 15 min tokens). Several services would need RS256/EdDSA with public keys.
- **Access tokens cannot be revoked (08):** a stolen token works until it expires (≤ 15 min). Logout/reuse detection
  in step 10 revoke only the refresh token. A deny-list would make JWTs stateful; not planned.
- npm 11 prints "allow-scripts" warnings on install; `tsx` works without approving any scripts.
