# Progress

**Read this first in every new session** (e.g. after `/clear`). It is updated in every PR, so on `main` it
always describes the merged state, and on a `pr/*` branch it describes that PR.

## Current state

- **Last merged step:** 02 (request logger)
- **In review:** 03 (`pr/03-error-handling`): waiting for the user to push, open the PR, and merge
- **Next step:** 04 (`pr/04-validation`): Zod middleware for body/params/query, `VALIDATION_ERROR` with `details`

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
| 02 | Request logger | ✅ PR #2 | `lib/logger` = `core.ts` (pino + redaction) + `express.ts` (pino-http adapter) |
| – | Smaller PR budget | ✅ PR #3 (`chore/smaller-prs`) | docs only |
| 03 | Error handling | 🔍 PR in review | `lib/errors` = `core.ts` (AppError, toAppError, toErrorBody, sourceLocation) + `express.ts` (404 + error handler) |

## Decisions (and why)

- **Pinned majors:** Vite 7, TypeScript 5.9, NestJS 11, React Router 7. The newest majors (Vite 8, TS 7, Nest 12, RR 8) were too new to rely on.
- **Logger:** pino over winston: faster, built-in redaction of secrets, `pino-http` for request logs.
- **Git flow:** Claude creates the branch and commits locally. The user pushes, opens the PR, and merges.
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
- **Redaction:** by exact key name, top level and up to 3 levels deep (`DEFAULT_REDACT_KEYS` in `lib/logger/core.ts`).
  Headers are not logged at all, but `authorization`/`cookie`/`set-cookie` are still redacted as a safety net.

## Local state that is not in git

- `backend-express/.env` exists locally (git-ignored), copied from `.env.example`.
- Nothing else: `frontend/`, `backend-nest/`, the root `package.json`, and `scripts/setup-env.mjs` were deleted on purpose.
  Each step creates its own files from scratch (frontend in step 14, Nest in step 26, `setup-env.mjs` in step 07, root scripts in step 30).

## Known gaps (fixed in later steps)

- No route throws a 500 yet, so the 500 path was only tested with a temporary script (see `docs/prs/03-error-handling.md`).
- No automated tests yet; verification is typecheck + build + curl smoke tests.
- `express.json()` uses the default 100 kb body limit → explicit, smaller limit in step 05.
- npm 11 prints "allow-scripts" warnings on install; `tsx` works without approving any scripts.
