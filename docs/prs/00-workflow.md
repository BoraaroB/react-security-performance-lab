# PR 00: Workflow, implementation plan, and Claude Code skills

## What and why
Sets up how this project is built: one small PR per step, so every change is easy to follow.
Adds the project rules (`CLAUDE.md`), the step-by-step implementation plan, and three project skills
that Claude Code loads automatically. No application code yet.

## Changes
- `CLAUDE.md`: project rules (workflow, English-only, no AI attribution, stack, structure, security rules).
- `docs/IMPLEMENTATION_PLAN.md`: 30 small steps (Express → frontend → NestJS) plus the shared API contract.
- `.claude/skills/next-step/SKILL.md`: implements the next plan step as one small PR, then stops.
- `.claude/skills/portable-module/SKILL.md`: rules that keep every module copy-paste portable.
- `.claude/skills/explain-pr/SKILL.md`: explains a PR in plain language and quizzes for interviews.
- `docs/prs/00-workflow.md`: this description.

## How to test
- In Claude Code, type `/next-step`, `/portable-module` or `/explain-pr`; the skills should appear.
- Read `docs/IMPLEMENTATION_PLAN.md` and adjust the order or scope before step 01 starts.

## How to reuse in another project
Copy `.claude/skills/` and adapt `CLAUDE.md`. The skills only expect `docs/IMPLEMENTATION_PLAN.md` and `docs/prs/`.

## Verification
Documentation only; nothing to build.

## Interview questions
1. **Why small PRs?** Easier review, easier to find the commit that broke something, safer rollbacks.
2. **Why keep the core separate from the framework?** The same logic works in Express, Nest or Fastify,
   and it can be unit-tested without starting an HTTP server.
