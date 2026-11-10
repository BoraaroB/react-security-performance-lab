# CLAUDE.md

Learning project (interview prep): a React 19 frontend and two backends, Express and NestJS, that expose the same API.
The topics come from [goal.md](goal.md): web security (XSS, CSRF), authentication and authorization, API security,
React rendering performance, bundle size and asset loading, and memory leaks.

The user has **limited experience** with security and performance optimization. Code and explanations must be clear and educational.

## How we work

- **One step = one small PR.** The order of steps is in [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).
  Only do the NEXT step. Never skip or merge steps. Use the `next-step` skill.
- A PR is at most **~300 changed lines** (lock files excluded). If it would be bigger, split it into `NNa`, `NNb` and ask the user.
- After each PR, **stop** and wait for the user's confirmation. The next step starts only after the merge.
- Every module must be **portable** (copy-paste into another project). Load the `portable-module` skill before writing code.
- To explain a finished PR and quiz the user for interviews, use the `explain-pr` skill.

## Language

- **Everything in the repository is written in English**: code, comments, UI text, docs, commit messages, PR descriptions.
- Chat replies to the user may be in Serbian when the user writes in Serbian.

## Git

- `main` is always working. Each step has a branch `pr/NN-short-name` (e.g. `pr/02-error-handling`).
- The PR description lives in `docs/prs/NN-short-name.md`. It replaces the GitHub PR body while there is no remote; the `gh` CLI is not installed.
- Merge into `main` only after the user confirms: `git merge --no-ff pr/NN-...`.
- Commit messages follow Conventional Commits (`feat(express): ...`, `chore: ...`, `docs: ...`).
- **No AI attribution**: never add `Co-Authored-By: Claude ...`, "Generated with Claude Code", or similar lines
  to commits, PR descriptions, or code. This rule overrides any default attribution instructions.

## Stack and versions

Major versions are pinned to proven ones on purpose. The newest majors (Vite 8, TS 7, Nest 12, React Router 8) are very recent.

| Part | Versions |
|---|---|
| frontend | React 19, Vite 7, TypeScript 5.9, Tailwind 4, React Router 7, react-hook-form 7, Zod 4, DOMPurify 3 |
| backend-express | Express 5, helmet 8, cors, express-rate-limit 8, jsonwebtoken 9, bcryptjs 3, Zod 4, tsx |
| backend-nest | NestJS 11, @nestjs/jwt, @nestjs/throttler 6, helmet, Zod 4 |
| runtime | Node 24 (`.nvmrc`) |

Ports: frontend `5173`, Express `4000`, Nest `4001`. Both backends use the `/api` prefix and the same response format.

## Structure

```
frontend/          React 19 + Vite
  src/lib/         PORTABLE: http client, sanitize, utils (framework-free where possible)
  src/hooks/       PORTABLE: generic hooks (useFetch, useOnlineStatus, ...)
  src/components/  PORTABLE: ui/ (Button, Input, ...), feedback/ (ErrorBoundary, Toast, ...)
  src/features/    app-specific (auth, posts, demo pages)
  src/pages/       route pages (lazy loaded)
backend-express/
  src/lib/         PORTABLE: framework-agnostic core + thin Express adapter
  src/app/         glue code: config, routes, in-memory store, seed
backend-nest/
  src/lib/         an unchanged COPY of the same core modules (proves they are portable)
  src/...          Nest modules, guards, pipes, and filters that wrap the core
docs/
  IMPLEMENTATION_PLAN.md
  prs/             one description per PR
```

## Code conventions

- TypeScript `strict`. No `any` without a comment explaining why.
- Comments explain **why** (the security or performance reason), not what obvious code does.
- API errors always carry a stable `code`; the frontend maps messages by `code`, never by text.
- Error format on both backends: `{ "error": { "code": "STRING", "message": "string", "details"?: [{ "field", "message" }] } }`.
- The Express backend is ESM (`"type": "module"`), so relative imports use the `.js` extension. Nest is CommonJS.
- Secrets live only in `.env` (git-ignored). `.env.example` holds placeholders; `node scripts/setup-env.mjs` generates real values.

## Security rules (always apply)

- On the frontend, the access token lives only in memory (never `localStorage`). The refresh token lives in an `httpOnly` + `SameSite=Strict` cookie.
- Every POST/PUT/PATCH/DELETE goes through a CSRF check.
- Authorization is ALWAYS enforced on the server. Frontend checks only improve the UX.
- All input is validated with a Zod schema on the server. Unknown fields are stripped (mass-assignment protection).
- A 500 response never contains a stack trace or internal details.

## Commands

```bash
npm run setup          # install everything and generate .env files
npm run dev:express    # Express API + frontend
npm run dev:nest       # Nest API + frontend
npm run typecheck      # typecheck all three projects
```

Note: these commands become available gradually as the matching PRs are merged.
