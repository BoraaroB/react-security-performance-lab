# Progress

**Read this first in every new session** (e.g. after `/clear`). It is updated in every PR, so on `main` it
always describes the merged state, and on a `pr/*` branch it describes that PR.

## Current state

- **Last merged:** 13a (OAuth core, PR #29)
- **In review:** step 13b (`pr/13b-oauth-github-start`): GitHub config + `GET /api/auth/oauth/github` (cookie + redirect)
- **Next:** step 13c (`pr/13c-oauth-github-callback`): the callback (validate query, clear cookie, check `state`,
  exchange the code, read the GitHub user, link/create the account, refresh cookie, redirect to the frontend).

## How to resume after `/clear`

1. `git switch main && git pull`
2. Check that EVERY branch listed under "In review" (`pr/*`, `chore/*`, `fix/*`, `feat/*`) is merged:
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
| 10a | Refresh tokens (core) | ✅ PR #20 | `lib/refresh-tokens` (`createRefreshTokenService` → `issue`, `rotate`; `createMemoryRefreshTokenStore`); no HTTP yet |
| 10b | Refresh cookie + `/refresh` | ✅ PR #21 | `__Secure-refresh_token` cookie on login/register, `POST /api/auth/refresh`, `cookie-parser`, `createApp({ users, refreshTokens })` |
| 10c | Logout | ✅ PR #22 | `revoke(token)` in `lib/refresh-tokens`, `POST /api/auth/logout` → 204, cookie cleared |
| – | Mobile auth | ✅ PR #23 (`feat/mobile-auth`) | `/api/mobile/auth/*`, refresh token in JSON, no CORS, `createAuthLimiters()` shared by web and mobile |
| 11 | CSRF | ✅ PR #24 | `lib/csrf` (`createCsrfTokenService`, `createCsrfProtection` → `protect`, `issueToken`), `GET /api/auth/csrf`, `CSRF_SECRET` |
| 12a | RBAC + admin users | ✅ PR #25 | `lib/rbac` (`hasRole`, `authorize({ allowedRoles, getRole })`), `GET /api/admin/users`, `requireAdmin` |
| 12b | Posts list + create | ✅ PR #26 | `PostRecord`, `posts.repository.ts`, `GET /api/posts`, `POST /api/posts`; second commit simplified the code for readability |
| 12c | Post ownership | ✅ PR #27 | `DELETE /api/posts/:id` (owner or admin, 404 vs 403); second commit added `getCurrentUser(req)` |
| 12d | Admin role change | ✅ PR #28 | `PATCH /api/admin/users/:id/role`, `CANNOT_CHANGE_OWN_ROLE`, caller re-checked before the write; second commit: `ROLES` const array |
| 13a | OAuth core | ✅ PR #29 | `lib/oauth` (`createOAuthClient` → `createAuthorizationRequest`, `exchangeCode`; `isSameState`) |
| 13b | GitHub login start | 🔍 `pr/13b-oauth-github-start` | `GITHUB_CLIENT_ID`/`SECRET`/`REDIRECT_URI`, `githubOAuth` in `security.ts`, `oauth.controller.ts`, `__Secure-oauth_github` cookie |

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
  500, fail closed; the `me` handler also throws (500) if `req.user` is missing (since 12c via `getCurrentUser(req)`). `app.ts` builds
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
- **Refresh cookie (step 10b):** `__Secure-refresh_token`, `HttpOnly; Secure; SameSite=Strict; Path=/api/auth`, `Expires` =
  the token's `expiresAt` (sliding 7 days, capped at 30 days per login). `Secure` always, also in dev: Chrome, Firefox
  and curl treat `http://localhost` as secure; Safari is unclear (older WebKit refused it), to check in step 21. `Path=/api/auth` (not
  `/api/auth/refresh`) so logout (10c) gets it too; it must match where `app.ts` mounts the auth router. The
  `__Secure-` prefix (found in review): browsers accept the cookie only over HTTPS with `Secure`, so a network attacker
  cannot plant their own refresh token through a plain-HTTP response (which would log the victim into the attacker's
  account; a CSRF token would not stop that). `__Host-` would be stronger but requires `Path=/`. The refresh token is never in a JSON body: `AuthResult` carries it, and the controller
  picks `{ accessToken, user }` field by field for the body (`sendAuthResult`). `SameSite=Strict` works in dev because
  `localhost:5173` and `localhost:4000` are the same site (ports do not count); in production the frontend and the API
  must be on the same site too (e.g. `app.example.com` + `api.example.com`).
- **`POST /api/auth/refresh` (step 10b):** reads the cookie, `rotate` → new access token + new refresh cookie →
  `{ accessToken, user }`. Every failure (no cookie, malformed, unknown, expired, reused, deleted user) → the same
  401 `UNAUTHORIZED` "Session expired, please log in again" (no oracle for someone holding a stolen token; found in the
  10a review). After `rotate`, the user is loaded by `userId`; a missing user → 401 (the new refresh token was never
  sent, so nobody holds it). No strict limiter (256-bit tokens cannot be guessed; the frontend refreshes often), global
  limit only; `no-store` from the router. CSRF check: step 11.
- **Cookie parsing (step 10b, new dependency):** `cookie-parser` 1.4.7 (+ `@types/cookie-parser` 1.4.10), the official
  Express middleware; it uses the same `cookie` package Express already depends on. `app.use(cookieParser())` after
  `express.json`, no secret (the refresh token is looked up, not signed). It turns values starting with `j:` into
  objects, so the controller accepts only a string.
- **Refresh-token wiring (step 10b):** `index.ts` creates `createMemoryRefreshTokenStore()` + `createRefreshTokenService`
  (defaults) and passes it in: `createApp({ users, refreshTokens })` (stateful things come in from outside, like
  `users`). The module's memory store is used, not a repository over `store.ts` (that would copy the same Map code), so
  `store.reset()` does not clear refresh tokens; a test creates a fresh refresh-token store instead.
- **Logout (step 10c):** `refreshTokens.revoke(token)` = format check → hash → `find` → `deleteFamily` (the whole
  login, so an older stolen copy dies too). It never throws (malformed, unknown, used, expired → nothing to do).
  `POST /api/auth/logout`: revoke first, then `res.clearCookie` with the SAME options as `res.cookie` (shared
  `REFRESH_COOKIE_OPTIONS`; a different `path` would leave the cookie in the browser), then 204. Always 204, with or
  without a cookie (idempotent, no oracle). No `requireUser`: the access token may have expired. Global limit only,
  `no-store` from the router. Ends only this login; the user's other sessions stay. CSRF check: step 11.
- **Mobile auth (side PR `feat/mobile-auth`, agreed with the user 2026-11-13):** native apps get their own routes
  `/api/mobile/auth/{register,login,refresh,logout}` (`routes/mobile-auth.routes.ts`, `controllers/mobile-auth.controller.ts`,
  `schemas/mobile-auth.schemas.ts`). Same `auth.service` and `lib/refresh-tokens`, unchanged: same rotation, reuse
  detection, expiry. The refresh token travels in the JSON body: response `{ accessToken, refreshToken,
  refreshTokenExpiresAt, user }`, request `{ refreshToken }` (Zod: string 1–256; the lib checks the exact format).
  Never a cookie (no `cookieParser` in the mobile chain), so no CSRF check is needed. **No CORS:** mounted in `app.ts`
  BEFORE `corsPolicy`, with its own chain (`globalLimiter` + `parseJson`, the same instances as the web chain) and its
  own `notFoundHandler`, so an unknown `/api/mobile/*` path never reaches the CORS middleware. A browser therefore
  cannot read these responses, and a cross-origin JSON POST fails the preflight (Express answers `OPTIONS` with
  `Allow` only). Why it matters: an XSS bug on the web frontend must not be able to get a refresh token from JSON,
  which would defeat `httpOnly`. **This holds only while the web frontend is on a different origin than the API**
  (found in review): with a dev proxy or nginx serving the frontend and proxying `/api` on one origin, CORS does not
  apply, so step 32 (and any dev proxy in step 14+) must keep `/api/mobile` unreachable from the web origin. The decision is made by Express's mount (case-insensitive, like routing), not by a
  string check on the path (`/API/MOBILE/...` was tested). Current user: `GET /api/auth/me` with a Bearer token (it
  reads no cookie). `createAuthLimiters()` (in `auth.routes.ts`) creates the login and register limiters once; both
  routers get the same instances, so web + mobile share ONE budget per IP (otherwise 10 + 10 password guesses).
  Client side (not in this repo): store the refresh token in the iOS Keychain / Android Keystore, never in plain
  storage; send one refresh at a time (two parallel refreshes look like reuse and log the user out); replace the
  stored token after every refresh. Logout: missing `refreshToken` → 400 `VALIDATION_ERROR` (a client bug; the web
  route is always 204 because the browser may have no cookie). Nest (step 28) must implement these routes too.
- **CSRF (step 11, one PR by the user's choice):** `lib/csrf` = `core.ts` (`createCsrfTokenService`, `isSafeMethod`,
  `isAllowedOrigin`; only `node:crypto`) + `express.ts` (`createCsrfProtection({ tokens, allowedOrigins })` →
  `{ protect, issueToken }`), depends on `lib/errors`. Every request except GET/HEAD/OPTIONS needs BOTH:
  (1) `Origin` exactly in the allowlist (`config.corsOrigins`, the same list as CORS); a missing `Origin` and `null`
  are rejected (only browsers use the cookie routes, and all current browsers send `Origin` on POST); (2) a token
  `<random>.<HMAC-SHA256(CSRF_SECRET, random)>` (both parts 43 base64url characters) that is equal in the
  `__Host-csrf` cookie and the `X-CSRF-Token` header (constant-time compare) and has a valid signature. Failures →
  403 `CSRF_INVALID` with "Request origin is not allowed" or "Invalid or missing CSRF token" (safe to tell apart, helps
  debugging). Cookie: `__Host-csrf; HttpOnly; Secure; SameSite=Strict; Path=/`, session cookie (no `Expires`).
  `__Host-` stops a sibling subdomain from planting its own token (the classic double-submit attack); `HttpOnly` is
  fine because the frontend reads the token from the JSON body. The signature only rejects made-up values: it does
  NOT stop planting, because the token is not bound to a session and anyone can get a signed pair (found in review).
  `GET /api/auth/csrf` returns the token from a still-valid cookie, or a new one (found in review: a new token on
  every call broke the token other tabs held in memory). `no-store` from the auth router, global limit only.
  Wiring: `app.use(csrf.protect)` right after `cookieParser()` and before every web router, so it covers all future
  web routes (posts, admin) and runs before the strict login/register limiters (forged requests do not use up the
  budget). The mobile chain is mounted earlier and is not covered (no cookies). `X-CSRF-Token` added to CORS
  `allowedHeaders` (closes the 05b gap). Side effect: `POST /api/demo/validation` now needs `Origin` + token too
  (curl: fetch `/api/auth/csrf` first, as in `docs/prs/11-csrf.md`), and an unsafe request to an unknown web path
  gets 403 `CSRF_INVALID` instead of 404 (the check runs before the 404 handler; fails closed). `isAllowedOrigin`
  rejects `null` even if a list contains it (found in review: a copied module could get "null" from an env var).
- **`CSRF_SECRET` (step 11):** required, no default, ≥ 32 characters; `setup-env.mjs` generates 32 random bytes
  (base64url). Its own value (one key per purpose): config rejects `CSRF_SECRET === JWT_SECRET` (found in review). Shared `csrfTokens` instance in `security.ts`.
- **Step 12 split (user's choice, 2026-11-13):** 12a = `lib/rbac` + `GET /admin/users`, 12b = posts list/create,
  12c = `DELETE /posts/:id` with ownership, 12d = `PATCH /admin/users/:id/role`. One concept per PR.
- **RBAC (step 12a):** `lib/rbac` = `core.ts` (`hasRole(role, allowedRoles)`: deny by default, exact match, no role
  hierarchy; `RbacConfigError`) + `express.ts` (`authorize({ allowedRoles, getRole })` → middleware), depends on
  `lib/errors`. `getRole` is a parameter so the module does not depend on the app's `req.user` type (two global
  declarations of `user` with different types would not compile). Glue: `getRole: (req) => req.user?.role`, the role
  of the user loaded on this request, never a token claim. No roles → `RbacConfigError` at startup; no user on the
  request (missing `requireUser`) → 500, fail closed and loud; wrong role → 403 `FORBIDDEN` "You do not have
  permission to do this" (does not name the required role). `requireAdmin = [...requireUser, adminOnly]`
  in `app.ts`.
  One function with options (like `cors({...})`), not a factory that returns `authorize(...roles)` (user's review):
  there is only one call site, so a function returning a function returning a middleware only made it harder to read.
  `allowedRoles` is `NoInfer<Role>[]`, so the role type comes from `getRole` and a typo (`'admn'`) does not compile.
- **Admin routes (step 12a):** `createAdminRouter({ admin, requireAdmin })` at `/api/admin`: `Cache-Control: no-store`
  first, then `router.use(requireAdmin)` for the whole router (a future admin route cannot forget it; an unknown
  `/api/admin/*` path gives a non-admin 401/403, an admin 404). `GET /users` → `{ users }` in the public shape (no
  `passwordHash`, even for admins), via `admin.service.ts` (`listUsers`) and `users.findAll()` (insertion order,
  decrypts every name). Global limit only. The service does not check the role itself; the router does.
- **Posts (step 12b):** `PostRecord` in `store.ts` (`id`, `authorId`, `title`, `content`, `createdAt`; plain text, not
  encrypted: every logged-in user reads posts anyway), `posts.repository.ts` (`create`, `findAll` newest first; returns
  copies), `posts.schemas.ts`, `posts.service.ts`, `posts.controller.ts`, `posts.routes.ts`; `createApp({ users, posts,
  refreshTokens })`. Router at `/api/posts`: `no-store` first, then `requireUser` for the whole router (like admin).
  `GET /` → `{ posts }` (every post of every user, newest first), `POST /` → 201 `{ post }`. CSRF from `app.ts`, global
  limit only. Response shape `PublicPost` = `{ id, title, content, createdAt, author: { id, name } | null }`: no author
  email (every user sees it; OWASP API3), `author.id` so the frontend can show "delete" on own posts (12c checks on the
  server); `null` if the account is gone (no user deletion exists yet). The service looks up the author per post
  (`users.findById`, decrypts the name each time). The author is `req.user.id`, never from the body.
  Schema: title trimmed, NFC, 1–200, no `\p{Cc}`/`\p{Cf}` (one line, anti-spoofing, same regex as `name`); content
  trimmed, 1–10,000 UTF-16 units (≤ 3 bytes each in UTF-8, so ≤ ~30 kb: fits the 32 kb JSON limit; tested with 10,000
  CJK characters → 201), no control characters except `\n`, `\r`, `\t` (found in review). `\p{Cf}` is allowed in
  content (emoji need the zero-width joiner), not in the title.
- **Post ownership (step 12c):** `DELETE /api/posts/:id` → 204. `postIdParamsSchema` (`id: z.uuid()`) → 400 for a
  non-UUID. `posts.service.deletePost(user, postId)`: unknown → 404 `NOT_FOUND` "Post not found"; not the author
  (`post.authorId === user.id`) and not an admin (`user.role === 'admin'`) → 403 `FORBIDDEN` (same message as
  `authorize`); else `posts.delete`. The check is in the service (it needs the loaded post), not in a middleware, and
  uses `req.user`, never a value from the request. 403 (not 404) for "not yours" because every logged-in user already
  sees every post; private resources should answer 404. A plain `user.role === 'admin'` instead of `hasRole` from
  `lib/rbac`: one comparison, easier to read. CSRF from `app.ts`, global limit only, `no-store` from the router.
- **`getCurrentUser(req)` (12c, user's review):** in `current-user.middleware.ts`. Handlers behind `requireUser`
  call it instead of `if (!req.user) throw ...`: Express types cannot know a middleware ran first, so `req.user` stays
  optional; the helper narrows it and throws (500, fail closed) on a wiring bug. Never `req.user!`. Used by posts
  `create`/`remove` and auth `me`; every new handler that needs the user (12d) uses it too.
- **Role change (step 12d):** `PATCH /api/admin/users/:id/role` `{ role }` → 200 `{ user }` (public shape).
  `admin.schemas.ts`: `userIdParamsSchema` (`z.uuid()`), `changeRoleSchema` (`z.enum(ROLES)`; extra fields stripped).
  **Roles have one source (user's review):** `ROLES = ['user', 'admin'] as const` in `store.ts`, `Role =
  (typeof ROLES)[number]`, re-exported by `users.repository.ts`. No TypeScript `enum` (runtime code, not erasable,
  plain strings not assignable). A new role is added only to `ROLES`. `admin.service.changeRole(currentAdmin, userId, role)` →
  `{ user, previousRole }`: unknown → 404 `NOT_FOUND` "User not found" (admins see every user, so 404 hides nothing);
  target is the caller → 409 `CANNOT_CHANGE_OWN_ROLE` (new code; any own change, not only a demotion); then the
  caller is loaded AGAIN and must still be an admin, else 403 `FORBIDDEN` (found in review: `validate` is async, so
  another request can demote the caller after `requireAdmin` ran). That re-check also keeps at least one admin: the
  caller is an admin at write time and is not the target, so two admins demoting each other cannot leave none. No
  separate admin count (an earlier `LAST_ADMIN` check was dropped as redundant in review). The re-check and the write
  run synchronously (atomic with the in-memory store); a real database needs one transaction for both.
  Repository: `updateRole` (void, like `updatePasswordHash`). No session revocation needed: the role is loaded per
  request, so a demotion counts on the next request (tested with the same token). The controller writes an `info`
  line "User role changed" `{ adminId, userId, from, to }` via `req.log` (the first handler log line in the app; IDs
  only; `from === to` marks a no-op). CSRF from `app.ts`, `requireAdmin` + `no-store` from the admin router, global
  limit only.
- **Step 13 split (user's choice, 2026-11-16):** 13a = `lib/oauth` core, 13b = config + redirect to GitHub,
  13c = callback + GitHub identity storage (one PR; ~200 lines expected, accepted by the user). The user creates the
  GitHub OAuth App (callback `http://localhost:4000/api/auth/oauth/github/callback`) and fills `.env` themselves.
- **One file per provider (13a, second commit, user's review):** `lib/oauth/providers/github.ts` holds
  `GITHUB_ENDPOINTS` (spread into `createOAuthClient`). Everything provider-specific goes there (13c adds
  `fetchGithubProfile` → a shared `OAuthProfile` `{ provider, providerUserId, email, name }` type in `core.ts`);
  `core.ts` is never copied per provider (security fixes in one place). Glue keeps only `clientId`, `clientSecret`,
  `redirectUri`. Accounts are linked by `provider + providerUserId` (never by email; see nOAuth for Microsoft), so
  Google/Microsoft later = one provider file + config + a value in the provider enum.
- **OAuth core (step 13a):** `lib/oauth/core.ts`, provider-agnostic (provider URLs in `providers/`), depends on
  `zod` and global `fetch`, no adapter (no framework code). `createAuthorizationRequest()` → `{ url, state,
  codeVerifier }`: `state` and verifier are 32 random bytes in base64url (43 characters), challenge =
  base64url(SHA-256(verifier)), method `S256` only (never `plain`). `scope` is left out when `scopes` is empty.
  `exchangeCode(code, verifier)` → `{ accessToken, scope }`: form-encoded POST with `Accept: application/json`
  (GitHub otherwise answers form-encoded), `redirect: 'error'` (the client secret never follows a redirect),
  `AbortSignal.timeout` (default 10 s). The body is checked for `{ error }` FIRST (GitHub answers errors with 200),
  then Zod + `token_type === 'bearer'`. Every failure is `OAuthError` `OAUTH_FAILED`; `providerError` holds the
  provider's code (e.g. `bad_verification_code`) and `cause` the network error, both for the log;
  `error_description` is ignored. `isSameState` compares in constant time and never throws. All three URLs must be
  https or `http://localhost`, and `timeoutMs` a positive integer (checked at startup, `OAuthConfigError`). The
  provider's access token is used only to read the profile (13c), never sent to the browser.
  What PKCE stops here (found in review): a client with a secret is not open to direct code theft, but to **code
  injection** (a stolen code pasted into OUR callback from the attacker's browser); the attacker's verifier differs.
- **Rules for 13b/13c (from the 13a review):** the `state` + verifier cookie is `HttpOnly; Secure; SameSite=Lax`
  (not `Strict`: the return from GitHub is a navigation started on github.com, so a `Strict` cookie is not sent; never
  `None`), `Path` = the callback route, ~10 min, cleared by the callback on success AND failure. The callback
  validates its query with Zod (`code`, `state`, provider `error` such as `access_denied`) and answers every failure
  with a redirect to the frontend login page carrying a stable error code, never a 500.
- **GitHub login start (step 13b):** `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET` are optional but must be set
  together (only one → startup fails); without them `config.github` and `githubOAuth` are `undefined` and the route
  is not registered (404, plus one startup info line). `GITHUB_REDIRECT_URI` is optional (default
  `http://localhost:<PORT>/api/auth/oauth/github/callback`); `createOAuthClient` rejects non-https URLs except
  localhost at startup, and production with GitHub on requires an https `GITHUB_REDIRECT_URI` (13b review). Its path must be
  `GITHUB_CALLBACK_PATH` (`/api/auth/oauth/github/callback`, config.ts), or the cookie (fixed `Path`) would never arrive. No scopes yet (GitHub's minimum = public profile); 13c adds `user:email` only if it needs the
  email. The route lives in the auth router (gets its `no-store`), global limit only, no `returnTo` (open redirect).
  Cookie `__Secure-oauth_github` = `<state>.<verifier>` (both base64url, so `.` is a safe separator), `HttpOnly; Secure;
  SameSite=Lax; Path=/api/auth/oauth/github/callback; Max-Age=600`. `GITHUB_COOKIE_OPTIONS` in `oauth.controller.ts`
  is shared with the callback's `clearCookie` (Express 5 ignores `maxAge` there). The cookie is not signed: an
  attacker who cannot write our cookies cannot change it (same trust as the refresh cookie; see Known gaps).
- **Simpler code (user's request after 12b, applies to every step):** the code must be easy to read for someone who
  just opens the file. No helper functions for one call site (inline the `if`), named regexes instead of bare ones,
  short comments (the "why" in 1–2 lines; long explanations go to the PR description), one field per line in objects. No HTML stripping on input: text is stored as typed and escaped on output (React); DOMPurify
  only where HTML must be rendered.
- **Redaction:** by exact key name, top level and up to 3 levels deep (`DEFAULT_REDACT_KEYS` in `lib/logger/core.ts`).
  Headers are not logged at all, but `authorization`/`cookie`/`set-cookie` are still redacted as a safety net.

## Local state that is not in git

- `backend-express/.env` exists locally (git-ignored). It needs `DATA_ENCRYPTION_KEY` (07a), `JWT_SECRET` (08) and `CSRF_SECRET` (11):
  run `node scripts/setup-env.mjs` (it fills empty secrets and keeps everything else).
  For GitHub login (13b+), the user adds `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` from their own GitHub OAuth App.
- Nothing else: `frontend/`, `backend-nest/`, and the root `package.json` were deleted on purpose.
  Each step creates its own files from scratch (frontend in step 14, Nest in step 26, root scripts in step 30).

## Known gaps (fixed in later steps)

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
- **JSON limit vs post size (05a → handled in 12b):** content ≤ 10,000 UTF-16 units fits 32 kb for any normal text.
  A body full of 6-byte JSON escapes (control characters as `\u00XX`, which the schema rejects anyway, or hand-escaped
  letters like `A`) can still pass 32 kb and get 413 instead of `VALIDATION_ERROR`: the body limit runs before
  validation. Rejected either way; normal text never does this. Accepted.
- `Cache-Control: no-store` is set on `/api/auth/*` (09a), `/api/admin/*` (12a) and `/api/posts/*` (12b).
- **Posts list is not paginated (12b):** `GET /api/posts` returns every post and decrypts each author's name once per
  post. Same fix as the admin list: `limit` + a cursor. No per-user limit on creating posts either (global 300 / 15 min
  only), so one user can fill the in-memory store; a real app would add a write limiter per user.
- **Deletes are permanent and not audited (12c; role changes are logged since 12d):** a deleted post is gone (no soft delete), and an admin deleting
  someone else's post leaves only the request log line (`DELETE /api/posts/<id> → 204`, no "who deleted whose post").
  A real app would keep an audit log for admin actions. Not planned.
- **Admin user list is not paginated (12a review, low):** `GET /api/admin/users` returns every user and decrypts
  every name on each call. Fine for the in-memory demo; a real store needs `limit` + a cursor (Zod-validated query).
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
- **Refresh-token reuse is not logged as a security event (10a review → postponed in 10b):** a reused token gives the
  same `UNAUTHORIZED` warn line as an expired one. Operators should see reuse (possible theft) with `userId`,
  `familyId`, and the request ID (never the token or its hash). Needs `userId`/`familyId` on `RefreshTokenError` and a
  logger in the auth service. Good fit for the same small side PR as "No client IP on failed logins" (auth security events).
- **Sibling subdomains can still set the refresh cookie (10b):** `__Secure-` stops plain-HTTP planting, but any HTTPS
  subdomain of the same site (e.g. a hacked `blog.example.com`) could still set a `Domain=example.com` cookie with the
  same name. Only `__Host-` (needs `Path=/`) or keeping untrusted subdomains off the site prevents that.
- **Two GitHub logins at once (13b):** each start overwrites the one `__Secure-oauth_github` cookie, so finishing the
  older login (e.g. in another tab) fails the `state` check and goes back to the login page. Safe; starting again works.
- **The OAuth cookie can be planted from a sibling subdomain (13b review, low):** same as the refresh cookie: `__Secure-`
  does not stop a hacked `*.example.com` from setting it. The attacker plants their own `state.verifier` and sends the
  victim to the callback with their own `code`: login CSRF (the victim ends up in the attacker's account). Signing
  would not help (our start route hands out valid values). `__Host-oauth_github` with `Path=/` would close it (sent
  with every API request for 10 minutes); kept `__Secure-` + callback path as planned. **Rule for 13c:** the callback
  must never link GitHub to an already logged-in account (it cannot anyway: the `SameSite=Strict` refresh cookie is not
  sent on the navigation back from GitHub); otherwise this gap becomes account takeover.
- **A failed refresh does not clear the cookie (10b):** a dead `refresh_token` cookie stays in the browser until it
  expires, the user logs in again, or logs out (10c clears it; harmless anyway: it is useless).
- **No "log out everywhere" (10c):** logout ends only the current login. A password change or "log out of all devices"
  needs a `deleteByUser(userId)` store method (and an index on `userId` in a database).
- **Access tokens survive logout (10c):** an access token issued before logout keeps working until it expires
  (≤ 15 min, see "Access tokens cannot be revoked (08)"). The frontend drops it from memory on logout (step 21).
- **Mobile refresh token is a bearer secret (feat/mobile-auth):** whoever holds it can use it (until rotation
  reuse detection catches it). No device binding (DPoP, RFC 9449, or app attestation) is planned; a good interview topic.
- **Mobile routes rely on separate origins (feat/mobile-auth review):** if the web frontend and the API ever share
  an origin (Vite dev proxy, nginx in step 32), `/api/mobile/*` must not be proxied on that origin, or an XSS could
  read a refresh token from JSON (it would still need the password or an existing refresh token).
- **Mobile refresh reuse is not logged as a security event:** same gap as 10a (`REUSED` looks like `UNAUTHORIZED`).
- **CSRF token not bound to a session (11):** any valid cookie + header pair works for any user. The `__Host-`
  prefix is what stops planting; binding (HMAC over a session ID, rotated on login) would be stronger. Not planned.
- **CSRF Origin list in a same-origin setup (11 → step 32):** `protect` uses `config.corsOrigins`. If nginx serves
  the frontend and proxies `/api` on ONE origin (step 32), that origin must still be in `CORS_ORIGINS`, or every
  POST gets 403 (production's default list is empty).
- **Frontend must fetch the CSRF token (11 → step 21):** call `GET /api/auth/csrf` (with `credentials: 'include'`)
  before the first POST, keep the token in memory, send `X-CSRF-Token` on every unsafe request, and fetch a new one
  once after a 403 `CSRF_INVALID` (the session cookie was lost when the browser closed, or a page made the browser
  navigate to `/api/auth/csrf` without the cookie, which sets a new one).
- **Nest (step 28):** `CsrfGuard` must call the same `core.ts` and apply only to cookie routes, not `/api/mobile/*`.
- npm 11 prints "allow-scripts" warnings on install; `tsx` works without approving any scripts.
