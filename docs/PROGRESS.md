# Progress

**Read this first in every new session** (e.g. after `/clear`). It is updated in every PR, so on `main` it
always describes the merged state, and on a `pr/*` branch it describes that PR.

## Current state

- **Last merged step:** 01 (Express skeleton)
- **In review:** 02 (`pr/02-request-logger`): waiting for the user to push, open the PR, and merge
- **Next step:** 03 (`pr/03-error-handling`): `AppError`, central error handler, JSON 404, error logs with request ID

## How to resume after `/clear`

1. `git switch main && git pull`
2. Check whether the "In review" step is merged: its commits appear in `git log origin/main --oneline`
   (or `git merge-base --is-ancestor pr/NN-... origin/main`). If unsure, ask the user.
3. Merged → run the `next-step` skill. Not merged → ask the user before doing anything else.

## Done

| # | Step | How it landed | Notes |
|---|---|---|---|
| 00 | Workflow, plan, skills | pushed directly to `main` (no PR) | `git branch -M main` was run while on the PR branch; accepted as is |
| 01 | Express skeleton | ✅ PR #1 | Added `lib/graceful-shutdown` as an extra portable module (not in the original plan) |
| 02 | Request logger | 🔍 PR in review | `lib/logger` = `core.ts` (pino + redaction) + `express.ts` (pino-http adapter) |

## Decisions (and why)

- **Pinned majors:** Vite 7, TypeScript 5.9, NestJS 11, React Router 7. The newest majors (Vite 8, TS 7, Nest 12, RR 8) were too new to rely on.
- **Logger:** pino over winston: faster, built-in redaction of secrets, `pino-http` for request logs.
- **Git flow:** Claude creates the branch and commits locally. The user pushes, opens the PR, and merges.
- **No AI attribution** in commits or PR descriptions.
- **Language:** everything in the repo is English; chat with the user is in Serbian.
- **Dependencies per step:** each PR adds only the npm packages it uses.
- **Docker:** added as Phase D (steps 31–32) at the end of the plan. Local development stays without Docker; logs go to stdout (no log files), which is what Docker expects.
- **pino 10 / pino-http 11 / pino-pretty 13:** `pino-pretty` is a dev dependency; it is loaded only when `pretty: true` (non-production).
- **Request ID:** a new UUID per request by default. An incoming `X-Request-Id` is reused only with
  `trustIncomingRequestId: true` (behind a trusted proxy) and only if it matches `^[\w-]{1,64}$` (no log injection).
- **Request log shape:** `req.log` is a child logger with only `reqId` (`quietReqLogger`), so handler logs stay short.
  The request line logs the path without the query string; `query` and `body` are logged only when `logPayloads` is on (dev).
- **Redaction:** by exact key name, top level and up to 3 levels deep (`DEFAULT_REDACT_KEYS` in `lib/logger/core.ts`).
  Headers are not logged at all, but `authorization`/`cookie`/`set-cookie` are still redacted as a safety net.

## Local state that is not in git

- `backend-express/.env` exists locally (git-ignored), copied from `.env.example`.
- Nothing else: `frontend/`, `backend-nest/`, the root `package.json`, and `scripts/setup-env.mjs` were deleted on purpose.
  Each step creates its own files from scratch (frontend in step 14, Nest in step 26, `setup-env.mjs` in step 07, root scripts in step 30).

## Known gaps (fixed in later steps)

- Unknown routes return Express's default HTML 404 page → JSON 404 in step 03.
- Invalid JSON bodies and thrown errors go to Express's default handler (stack printed to the console, HTML response) → step 03.
  The request line itself is already logged correctly (`WARN POST ... → 400`).
- The step 03 error handler should log through `req.log` so error lines carry `reqId`.
- `express.json()` uses the default 100 kb body limit → explicit, smaller limit in step 05.
- npm 11 prints "allow-scripts" warnings on install; `tsx` works without approving any scripts.
