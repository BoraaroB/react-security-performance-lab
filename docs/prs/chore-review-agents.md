# chore: automatic code and security review agents, plan additions

## What and why
Every PR is now checked by two read-only review agents before the commit: `code-reviewer` (bugs, project rules,
size, portability) and `security-reviewer` (input, leaks, crypto, auth, CSRF/CORS, config, deploy). They catch problems
like "safe in development, dangerous in production" (the demo routes in PR 04). The plan also gets the gaps found after PR 04.

## Changes
- `.claude/agents/code-reviewer.md`, `.claude/agents/security-reviewer.md`: the two agents (read-only, never read `.env`).
- `.claude/skills/next-step/SKILL.md`: sections in the order they are done; new "Automatic review" section; `## Review`
  in the PR template; checks that every "In review" branch (`pr/*`, `chore/*`, `fix/*`) is merged before a new step.
- `.claude/settings.json`: Claude Code may not read `.env` files (any folder); `.env.example` stays readable.
- `CLAUDE.md`: the review rule and where side-branch PR descriptions live.
- `docs/IMPLEMENTATION_PLAN.md`: step 04b (process errors, non-zero exit), `trust proxy` in step 06 (hop count, never `true`),
  Phase E (backend ESLint, tests, CI with safe GitHub Actions settings).
- `docs/PROGRESS.md`: current state, decisions, resume steps for side branches, known gaps.

## How to test
Next `next-step` run: before the commit, both agents run in parallel and the PR description has a filled `## Review` section.

## Review
The agents reviewed this PR themselves (as `general-purpose` agents following the new files).
- code-reviewer (7): all fixed. `npx tsc` from the repo root could download a wrong package → `npm --prefix <project> run typecheck`;
  section order in `next-step` was confusing → reordered; side branches had no plan row and were not part of the resume
  check → handled in the skill, agents, CLAUDE.md, and PROGRESS; fallback agents now told not to write files; known-gap pointer to Phase E.
- security-reviewer (8): 7 fixed, 1 left to the user. Fixed: `grep -r` could print `.env` secrets → `git grep` only;
  `trust proxy` design and 04b non-zero exit written into the plan; checklist extended with crypto, sessions,
  redirects/OAuth, CSRF/CORS details, Docker and GitHub Actions; CI row lists safe workflow settings.
  The `.env` deny rule (a permission change) was the user's decision: added as `.claude/settings.json`.

## How to test the `.env` rule
Ask Claude Code to read `backend-express/.env` → "denied by your permission settings". `.env.example` still works.
