# Progress

**Read this first in every new session** (e.g. after `/clear`). It is updated in every PR, so on `main` it
always describes the merged state, and on a `pr/*` branch it describes that PR.

## Current state

- **Last merged step:** 00 (workflow, plan, skills)
- **In review:** 01 (`pr/01-express-skeleton`): waiting for the user to push, open the PR, and merge
- **Next step:** 02 (`pr/02-request-logger`): pino logger, request ID, redaction

## How to resume after `/clear`

1. `git switch main && git pull`
2. Check whether the "In review" step is merged: its commits appear in `git log origin/main --oneline`
   (or `git merge-base --is-ancestor pr/NN-... origin/main`). If unsure, ask the user.
3. Merged → run the `next-step` skill. Not merged → ask the user before doing anything else.

## Done

| # | Step | How it landed | Notes |
|---|---|---|---|
| 00 | Workflow, plan, skills | pushed directly to `main` (no PR) | `git branch -M main` was run while on the PR branch; accepted as is |
| 01 | Express skeleton | 🔍 PR in review | Added `lib/graceful-shutdown` as an extra portable module (not in the original plan) |

## Decisions (and why)

- **Pinned majors:** Vite 7, TypeScript 5.9, NestJS 11, React Router 7. The newest majors (Vite 8, TS 7, Nest 12, RR 8) were too new to rely on.
- **Logger:** pino over winston: faster, built-in redaction of secrets, `pino-http` for request logs.
- **Git flow:** Claude creates the branch and commits locally. The user pushes, opens the PR, and merges.
- **No AI attribution** in commits or PR descriptions.
- **Language:** everything in the repo is English; chat with the user is in Serbian.
- **Dependencies per step:** each PR adds only the npm packages it uses.

## Local state that is not in git

- `frontend/` and `backend-nest/` contain only `package.json` + `node_modules` (dependencies already installed).
  They are committed in steps 14 and 26.
- The root `package.json`, `package-lock.json`, and `scripts/setup-env.mjs` are untracked; they are committed when first needed (step 07 for secrets, step 30 for root scripts).
- `backend-express/.env` exists locally (git-ignored), copied from `.env.example`.

## Known gaps (fixed in later steps)

- Unknown routes return Express's default HTML 404 page → JSON 404 in step 03.
- `express.json()` uses the default 100 kb body limit → explicit, smaller limit in step 05.
- npm 11 prints "allow-scripts" warnings on install; `tsx` works without approving any scripts.
