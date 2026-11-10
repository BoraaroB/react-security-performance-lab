# Progress

**Read this first in every new session** (e.g. after `/clear`). It is updated in every PR, so on `main` it
always describes the merged state, and on a `pr/*` branch it describes that PR.

## Current state

- **Last merged step:** 04 (validation), plus side PRs `fix/demo-routes-flag` (#7) and `chore/review-agents` (#6)
- **In review:** 04b (`pr/04b-process-errors`): crash handlers in `lib/graceful-shutdown`
- **Next step:** 05 (`pr/05-security-headers-cors`): helmet, CORS allowlist with credentials, body size limit

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
| 04b | Process errors | 🔍 `pr/04b-process-errors` | `uncaughtException` / `unhandledRejection` → fatal log, graceful shutdown, exit 1 |

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
- **Redaction:** by exact key name, top level and up to 3 levels deep (`DEFAULT_REDACT_KEYS` in `lib/logger/core.ts`).
  Headers are not logged at all, but `authorization`/`cookie`/`set-cookie` are still redacted as a safety net.

## Local state that is not in git

- `backend-express/.env` exists locally (git-ignored), copied from `.env.example`.
- Nothing else: `frontend/`, `backend-nest/`, the root `package.json`, and `scripts/setup-env.mjs` were deleted on purpose.
  Each step creates its own files from scratch (frontend in step 14, Nest in step 26, `setup-env.mjs` in step 07, root scripts in step 30).

## Known gaps (fixed in later steps)

- **Keep-alive during shutdown (found in 04b review):** after `server.close()`, a client with an already open keep-alive
  connection can keep sending requests and they are still served until the force-exit timeout (10 s). Applies to SIGTERM
  and to crashes. Fix idea: send `Connection: close` on every response once shutdown starts. Small side PR or with Docker (step 31).
- No route throws a 500 yet, so the 500 path was only tested with a temporary script (see `docs/prs/03-error-handling.md`).
- The request log line shows the body/query AFTER validation (it is written when the response finishes),
  so stripped fields (e.g. an attempted `role: "admin"`) are not visible in the log. Accepted for now.
- No automated tests yet; verification is typecheck + build + curl smoke tests + review agents → Phase E (steps 33–35).
- Shell commands (`cat .env`) are not covered by the `Read(...)` deny rules in `.claude/settings.json`; only Claude Code's
  built-in file tools are. Full coverage would need Claude Code's Bash sandbox (not enabled; the user decides).
- `express.json()` uses the default 100 kb body limit → explicit, smaller limit in step 05.
- npm 11 prints "allow-scripts" warnings on install; `tsx` works without approving any scripts.
