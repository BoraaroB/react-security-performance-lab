# Implementation plan

Each row is **one small PR** (branch `pr/NN-...`, description in `docs/prs/NN-...md`).
After each PR we stop and wait for confirmation.

**Status:** ⬜ todo · 🔍 in review (branch ready) · ✅ merged into `main`

**Goal column** (from [goal.md](../goal.md)): S1 = XSS/CSRF, S2 = auth (OAuth/JWT/RBAC), S3 = API security,
P1 = React rendering, P2 = bundle size and loading, P3 = memory leaks, DX = developer experience / observability.

---

## Phase 0: Setup

| # | PR | What we get | Goal | Status |
|---|---|---|---|---|
| 00 | `pr/00-workflow` | CLAUDE.md, this plan, skills (`next-step`, `portable-module`, `explain-pr`) | – | ✅ |

## Phase A: Express backend (`backend-express`)

| # | PR | What we get | Portable modules | Goal | Status |
|---|---|---|---|---|---|
| 01 | `pr/01-express-skeleton` | Express 5 + TS (ESM), `/api/health`, graceful shutdown, `.env` validation | `lib/env`, `lib/graceful-shutdown` | S3 | ✅ |
| 02 | `pr/02-request-logger` | pino logger, request ID (`X-Request-Id`), one log line per request: method, URL, status, duration, query and body (dev only), secrets redacted, pretty output in dev and JSON in prod | `lib/logger` | DX, S3 | ✅ |
| 03 | `pr/03-error-handling` | `AppError`, central error handler, 404, one JSON error format, no stack traces in responses; errors logged with request ID and source location (`file:line`) | `lib/errors` | S3, DX | 🔍 |
| 04 | `pr/04-validation` | Zod middleware for body/params/query, `VALIDATION_ERROR` with `details` | `lib/validation` | S1, S3 | ⬜ |
| 05 | `pr/05-security-headers-cors` | helmet (CSP, HSTS, ...), CORS allowlist with credentials, body size limit | `lib/security` | S1, S3 | ⬜ |
| 06 | `pr/06-rate-limiting` | Global + strict auth limiter, `429 RATE_LIMITED` + `Retry-After`, demo route | `lib/rate-limit` | S3 | ⬜ |
| 07 | `pr/07-crypto-store` | AES-256-GCM (data at rest), bcrypt, secure random, in-memory store + seed | `lib/crypto`, `lib/password` | S2, S3 | ⬜ |
| 08 | `pr/08-jwt-access-token` | Sign/verify JWT (pinned algorithm, iss/aud), `authenticate` middleware | `lib/jwt` | S2 | ⬜ |
| 09 | `pr/09-register-login` | `POST /auth/register`, `/auth/login`, `GET /auth/me`, user-enumeration protection | – | S2 | ⬜ |
| 10 | `pr/10-refresh-token-rotation` | Refresh token in an httpOnly cookie, rotation, reuse detection, logout | `lib/refresh-tokens` | S2 | ⬜ |
| 11 | `pr/11-csrf` | Signed double-submit CSRF + `Origin` check, `GET /auth/csrf` | `lib/csrf` | S1 | ⬜ |
| 12 | `pr/12-rbac-posts` | Roles (`user`/`admin`), `authorize(...)`, resource ownership, posts CRUD, admin routes | `lib/rbac` | S2 | ⬜ |
| 13 | `pr/13-oauth-github` | OAuth 2.0 Authorization Code + PKCE + `state` (optional, needs GitHub keys) | `lib/oauth` | S2 | ⬜ |

## Phase B: Frontend (`frontend`)

| # | PR | What we get | Portable modules | Goal | Status |
|---|---|---|---|---|---|
| 14 | `pr/14-frontend-setup` | Vite 7 + React 19 + TS + Tailwind 4, `@/` alias, ESLint (react-hooks) | `lib/cn` | – | ⬜ |
| 15 | `pr/15-ui-components` | Button, FormField, Input, Textarea, Select, Card, Alert, Badge, Spinner (React 19 `ref` as a prop) | `components/ui/*` | – | ⬜ |
| 16 | `pr/16-router-lazy-loading` | React Router, `React.lazy` + Suspense, preload on hover, layout, 404 | `lib/lazy-with-preload` | P2 | ⬜ |
| 17 | `pr/17-error-handling-ui` | ErrorBoundary, route and chunk-load errors, toast system, React 19 `onCaughtError`/`onUncaughtError` | `components/feedback/*` | – | ⬜ |
| 18 | `pr/18-http-client` | Fetch client: `ApiError`/`NetworkError`/`TimeoutError`, timeout, retry + backoff, abort, offline banner; shows the server's request ID in errors | `lib/http`, `hooks/useOnlineStatus` | S3, DX | ⬜ |
| 19 | `pr/19-use-fetch` | `useFetch` with AbortController (no leaks), `ErrorState` with a retry button | `hooks/useFetch` | P3 | ⬜ |
| 20 | `pr/20-forms` | react-hook-form + Zod, mapping server errors to fields, login and register forms | `lib/forms` | S1 | ⬜ |
| 21 | `pr/21-auth-client` | In-memory token, single-flight refresh, CSRF header, AuthProvider, ProtectedRoute, RequireRole, safe redirect | `lib/http` (auth plugin) | S1, S2 | ⬜ |
| 22 | `pr/22-dashboard-admin` | Posts (create, optimistic delete with `useOptimistic`), admin role management | – | S2, P1 | ⬜ |
| 23 | `pr/23-security-demo` | Demos: XSS (React escaping vs DOMPurify), dangerous URLs, CSRF, rate limit, CSP in `vite preview` | `lib/sanitize` | S1, S3 | ⬜ |
| 24 | `pr/24-performance-demo` | `memo`/`useMemo`/`useCallback`, `useDeferredValue`, VirtualList, manualChunks, bundle analysis, dynamic import | `components/ui/VirtualList` | P1, P2 | ⬜ |
| 25 | `pr/25-memory-leaks-demo` | Leaky vs fixed components (interval, listener, cache), `useEventListener`, `useInterval` | `hooks/useEventListener`, `hooks/useInterval` | P3 | ⬜ |

## Phase C: NestJS backend (`backend-nest`)

The core modules from Express are **copied unchanged** into `src/lib/`. This proves they are really portable.

| # | PR | What we get | Goal | Status |
|---|---|---|---|---|
| 26 | `pr/26-nest-skeleton` | Nest 11 + config + the same `lib/logger` (request logging middleware) + global exception filter (same error format and error logs) + health | S3, DX | ⬜ |
| 27 | `pr/27-nest-security` | helmet, CORS, `ThrottlerModule`, `ZodValidationPipe` | S3 | ⬜ |
| 28 | `pr/28-nest-auth` | JWT guard, register/login/refresh/logout, `CsrfGuard` | S1, S2 | ⬜ |
| 29 | `pr/29-nest-rbac-posts` | `@Roles()` + `RolesGuard`, posts and admin modules, OAuth | S2 | ⬜ |
| 30 | `pr/30-wiring-readme` | `npm run dev:nest`, root scripts, README with a "topic → file" map | – | ⬜ |

## Phase D: Docker

Local development stays without Docker (`tsx watch` and Vite HMR are faster). Docker is for running the finished apps
the way they would run in production.

| # | PR | What we get | Goal | Status |
|---|---|---|---|---|
| 31 | `pr/31-docker-backends` | Dockerfile for Express and Nest: multi-stage build, non-root user, small base image, `HEALTHCHECK` on `/api/health`, `.dockerignore` (no `.env` in the image) | S3 | ⬜ |
| 32 | `pr/32-docker-compose` | Frontend served by nginx (CSP and security headers, asset caching, compression), `docker-compose.yml` for all three apps | S1, P2 | ⬜ |

---

## Logging (both backends)

Development: readable, colored, with payloads. Production: one JSON object per line, no payloads.

```
12:00:01.123 INFO  POST /api/auth/login → 401 (245 ms)  reqId=9f2c1a
    body: { "email": "user@example.com", "password": "[REDACTED]" }
12:00:01.130 WARN  INVALID_CREDENTIALS: Invalid email or password  reqId=9f2c1a
12:00:05.410 ERROR INTERNAL_ERROR: Cannot read properties of undefined  reqId=7b11e0
    at src/app/routes/posts.ts:42:11
```

Rules:
- Every request gets a request ID. It is returned in the `X-Request-Id` header and included in every log line for that request.
- **Never log secrets**: `password`, `token`, `accessToken`, `refreshToken`, `csrfToken`, the `Authorization` and `Cookie`
  headers, and `Set-Cookie` are always replaced with `[REDACTED]`.
- 4xx errors are logged as `warn` (client mistake), 5xx as `error` with the stack and source location.
- Source locations point to `.ts` files: `tsx` enables source maps in dev, and the production build runs with `node --enable-source-maps`.
- Log level comes from `LOG_LEVEL` (`debug` in dev, `info` in prod).

## API contract (same for both backends)

| Method | Path | Protection | Description |
|---|---|---|---|
| GET | `/api/health` | – | server status |
| GET | `/api/auth/csrf` | – | sets the CSRF cookie, returns `{ csrfToken }` |
| POST | `/api/auth/register` | CSRF, rate limit | `{ name, email, password }` → `{ accessToken, user }` + refresh cookie |
| POST | `/api/auth/login` | CSRF, rate limit | `{ email, password }` → `{ accessToken, user }` + refresh cookie |
| POST | `/api/auth/refresh` | CSRF, refresh cookie | rotates the refresh token → `{ accessToken, user }` |
| POST | `/api/auth/logout` | CSRF | revokes the session, clears the cookie → 204 |
| GET | `/api/auth/me` | JWT | `{ user }` |
| GET | `/api/auth/oauth/github` | – | redirect to GitHub |
| GET | `/api/auth/oauth/github/callback` | `state` + PKCE | redirect to the frontend |
| GET | `/api/posts` | JWT | `{ posts }` |
| POST | `/api/posts` | JWT, CSRF | `{ title, content }` → `{ post }` |
| DELETE | `/api/posts/:id` | JWT, CSRF, owner or admin | 204 |
| GET | `/api/admin/users` | JWT, role `admin` | `{ users }` |
| PATCH | `/api/admin/users/:id/role` | JWT, CSRF, role `admin` | `{ role }` → `{ user }` |
| GET | `/api/demo/rate-limit` | 5 requests per minute | rate-limit demo |

Errors: `{ "error": { "code", "message", "details"?, "requestId" } }`. Key codes: `VALIDATION_ERROR`, `UNAUTHORIZED`,
`TOKEN_EXPIRED`, `INVALID_CREDENTIALS`, `FORBIDDEN`, `CSRF_INVALID`, `RATE_LIMITED`, `NOT_FOUND`, `INTERNAL_ERROR`.

Seeded demo accounts: `admin@example.com` / `Admin123!` (admin) and `user@example.com` / `User1234!` (user).
