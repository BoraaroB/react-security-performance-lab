---
name: next-step
description: Implements the NEXT step from docs/IMPLEMENTATION_PLAN.md as one small PR (new git branch, commit, description in docs/prs/). Use when the user says "next step", "let's continue", "sledeći korak", "idemo dalje", "make PR NN", or otherwise asks to continue the implementation in this project.
---

# next-step: one step = one small PR

The goal is that the user can follow **every** change. Smaller is better.

## 1. Pick the step

1. Read `docs/PROGRESS.md` (current state, decisions, known gaps) and `docs/IMPLEMENTATION_PLAN.md`.
   Take the first ⬜ row unless the user named a step number.
2. Run `git switch main && git pull`, then check `git status` and `git log`:
   - If the previous step's `pr/*` branch is not merged into `origin/main` yet, **ask** the user to merge it first.
     Do not continue without an answer. Never merge or push yourself.
   - Untracked files that belong to future steps (e.g. another project's `package.json`) may stay.
     Commit only what belongs to this step.
3. Create the branch from `main`: `git switch -c pr/NN-short-name` (name from the plan).

## 2. Implement ONLY that step

- Before writing code, load the `portable-module` skill and follow it for every module in `lib/`, `hooks/` and `components/`.
- No drive-by refactors, no code for future steps, no new dependencies the plan does not mention.
  If a new dependency is unavoidable, list it in the PR description with the reason.
- Budget: **~150 changed lines of code** (lock files and `docs/` excluded) and **one new concept** per PR.
  If it will be more, stop, propose a split (`NNa`, `NNb`, ...) and ask. When in doubt, split.
- Keep the PR description short too (aim for ~40 lines): the user reads all of it.
- Everything is in English: code, comments, UI text, docs.
- Comments explain **why** (the security or performance reason), not what obvious code does.

## 3. Verify it works

Run everything that applies and record the result in the PR description:
- `npm run typecheck` (and `build` where it exists) in the changed project.
- Smoke test: for the backend, start the server in the background, check it with `curl -i`, then stop it.
  For the frontend, run `vite build` and, when useful, the dev server.
- If something fails, fix it before committing. If you cannot, say so clearly in the PR description.

## 4. PR description: `docs/prs/NN-short-name.md`

Write for a reader with limited experience. Keep it short:

```markdown
# PR NN: <title>

## What and why
2–4 sentences. Which problem it solves and which goal.md topic it covers.

## Changes
- `path/file.ts`: one sentence

## How to test
Exact commands (curl, npm, ...) and the expected result.

## How to reuse in another project
Which folder to copy, which npm packages to install, and a wiring example (3–10 lines).

## Verification
typecheck/build/smoke test: what was run and what came out.

## Interview questions
2–3 questions with short answers on this PR's topic.
```

## 5. Commit and finish

1. In `docs/IMPLEMENTATION_PLAN.md`, set this step's status to 🔍 and the previous (merged) step's status to ✅.
   Update `docs/PROGRESS.md`: "Current state" (last merged = previous step, in review = this step, next step),
   the "Done" table, any new decisions or deviations from the plan, and known gaps.
   It must be enough for a fresh session after `/clear` to continue without chat history.
2. `git add` only this step's files. The commit message follows Conventional Commits,
   e.g. `feat(express): add central error handler`.
   **No AI attribution**: no `Co-Authored-By: Claude`, no "Generated with Claude Code", in commits or PR descriptions.
3. **Do not push.** The user pushes, opens the PR on GitHub, and merges.
4. **STOP.** Tell the user briefly (in the user's chat language):
   - what was done (1–2 sentences) and the branch name,
   - how to review it locally: `git diff main...pr/NN-...`,
   - how to publish it: `git push -u origin pr/NN-...`, then open the PR and paste `docs/prs/NN-...md` as the body,
   - what the next step is.
   Do not start the next step until the user says the PR is merged.
