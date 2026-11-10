# Implementation plan

Each row is **one small PR** (branch `pr/NN-...`, description in `docs/prs/NN-...md`).
After each PR we stop and wait for confirmation.

**Status:** ⬜ todo · 🔍 in review (branch ready) · ✅ merged into `main`

**Goal column** (from [goal.md](../goal.md)): S1 = XSS/CSRF, S2 = auth (OAuth/JWT/RBAC), S3 = API security,
P1 = React rendering, P2 = bundle size and loading, P3 = memory leaks.

---

## Phase 0: Setup

| # | PR | What we get | Goal | Status |
|---|---|---|---|---|
| 00 | `pr/00-workflow` | CLAUDE.md, this plan, skills (`next-step`, `portable-module`, `explain-pr`) | – | 🔍 |

## Phase A: Express backend (`backend-express`)

| # | PR | What we get | Portable modules | Goal | Status |
|---|---|---|---|---|---|
| 01 | `pr/01-express-skeleton` | Express 5 + TS (ESM), `/api/health`, graceful shutdown, `.env` validation | `lib/env` (`loadEnv(schema)`) | S3 | ⬜ |
| 02 | `pr/02-error-handling` | `AppError`, central error handler, 404, one JSON error format, no stack traces | `lib/errors` | S3 | ⬜ |
| 03 | `pr/03-validation` | Zod middleware for body/params/query, `VALIDATION_ERROR` with `details` | `lib/validation` | S1, S3 | ⬜ |
| 04 | `pr/04-security-headers-cors` | helmet (CSP, HSTS, ...), CORS allowlist with credentials, body size limit | `lib/security` | S1, S3 | ⬜ |
| 05 | `pr/05-rate-limiting` | Global + strict auth limiter, `429 RATE_LIMITED` + `Retry-After`, demo route | `lib/rate-limit` | S3 | ⬜ |
| 06 | `pr/06-crypto-store` | AES-256-GCM (data at rest), bcrypt, secure random, in-memory store + seed | `lib/crypto`, `lib/password` | S2, S3 | ⬜ |
| 07 | `pr/07-jwt-access-token` | Sign/verify JWT (pinned algorithm, iss/aud), `authenticate` middleware | `lib/jwt` | S2 | ⬜ |
| 08 | `pr/08-register-login` | `POST /auth/register`, `/auth/login`, `GET /auth/me`, user-enumeration protection | – | S2 | ⬜ |
| 09 | `pr/09-refresh-token-rotation` | Refresh token in an httpOnly cookie, rotation, reuse detection, logout | `lib/refresh-tokens` | S2 | ⬜ |
| 10 | `pr/10-csrf` | Signed double-submit CSRF + `Origin` check, `GET /auth/csrf` | `lib/csrf` | S1 | ⬜ |
| 11 | `pr/11-rbac-posts` | Roles (`user`/`admin`), `authorize(...)`, resource ownership, posts CRUD, admin routes | `lib/rbac` | S2 | ⬜ |
| 12 | `pr/12-oauth-github` | OAuth 2.0 Authorization Code + PKCE + `state` (optional, needs GitHub keys) | `lib/oauth` | S2 | ⬜ |

## Phase B: Frontend (`frontend`)

| # | PR | What we get | Portable modules | Goal | Status |
|---|---|---|---|---|---|
| 13 | `pr/13-frontend-setup` | Vite 7 + React 19 + TS + Tailwind 4, `@/` alias, ESLint (react-hooks) | `lib/cn` | – | ⬜ |
| 14 | `pr/14-ui-components` | Button, FormField, Input, Textarea, Select, Card, Alert, Badge, Spinner (React 19 `ref` as a prop) | `components/ui/*` | – | ⬜ |
| 15 | `pr/15-router-lazy-loading` | React Router, `React.lazy` + Suspense, preload on hover, layout, 404 | `lib/lazy-with-preload` | P2 | ⬜ |
| 16 | `pr/16-error-handling-ui` | ErrorBoundary, route and chunk-load errors, toast system, React 19 `onCaughtError`/`onUncaughtError` | `components/feedback/*` | – | ⬜ |
| 17 | `pr/17-http-client` | Fetch client: `ApiError`/`NetworkError`/`TimeoutError`, timeout, retry + backoff, abort, offline banner | `lib/http`, `hooks/useOnlineStatus` | S3 | ⬜ |
| 18 | `pr/18-use-fetch` | `useFetch` with AbortController (no leaks), `ErrorState` with a retry button | `hooks/useFetch` | P3 | ⬜ |
| 19 | `pr/19-forms` | react-hook-form + Zod, mapping server errors to fields, login and register forms | `lib/forms` | S1 | ⬜ |
| 20 | `pr/20-auth-client` | In-memory token, single-flight refresh, CSRF header, AuthProvider, ProtectedRoute, RequireRole, safe redirect | `lib/http` (auth plugin) | S1, S2 | ⬜ |
| 21 | `pr/21-dashboard-admin` | Posts (create, optimistic delete with `useOptimistic`), admin role management | – | S2, P1 | ⬜ |
| 22 | `pr/22-security-demo` | Demos: XSS (React escaping vs DOMPurify), dangerous URLs, CSRF, rate limit, CSP in `vite preview` | `lib/sanitize` | S1, S3 | ⬜ |
| 23 | `pr/23-performance-demo` | `memo`/`useMemo`/`useCallback`, `useDeferredValue`, VirtualList, manualChunks, bundle analysis, dynamic import | `components/ui/VirtualList` | P1, P2 | ⬜ |
| 24 | `pr/24-memory-leaks-demo` | Leaky vs fixed components (interval, listener, cache), `useEventListener`, `useInterval` | `hooks/useEventListener`, `hooks/useInterval` | P3 | ⬜ |

## Phase C: NestJS backend (`backend-nest`)

The core modules from Express are **copied unchanged** into `src/lib/`. This proves they are really portable.

| # | PR | What we get | Goal | Status |
|---|---|---|---|---|
| 25 | `pr/25-nest-skeleton` | Nest 11 + config + global exception filter (same error format) + health | S3 | ⬜ |
| 26 | `pr/26-nest-security` | helmet, CORS, `ThrottlerModule`, `ZodValidationPipe` | S3 | ⬜ |
| 27 | `pr/27-nest-auth` | JWT guard, register/login/refresh/logout, `CsrfGuard` | S1, S2 | ⬜ |
| 28 | `pr/28-nest-rbac-posts` | `@Roles()` + `RolesGuard`, posts and admin modules, OAuth | S2 | ⬜ |
| 29 | `pr/29-wiring-readme` | `npm run dev:nest`, root scripts, README with a "topic → file" map | – | ⬜ |

---

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

Errors: `{ "error": { "code", "message", "details"? } }`. Key codes: `VALIDATION_ERROR`, `UNAUTHORIZED`,
`TOKEN_EXPIRED`, `INVALID_CREDENTIALS`, `FORBIDDEN`, `CSRF_INVALID`, `RATE_LIMITED`, `NOT_FOUND`, `INTERNAL_ERROR`.

Seeded demo accounts: `admin@example.com` / `Admin123!` (admin) and `user@example.com` / `User1234!` (user).
