# PR 14: Frontend setup (Vite 7 + React 19 + TypeScript + Tailwind 4)

## What and why
Phase B starts: `frontend/` is created from scratch. It is the base for every later frontend topic in goal.md
(XSS/CSRF demos, auth client, rendering performance, bundle size, memory leaks). Two small things already matter
for those topics: ESLint's `react-hooks` rules catch missing effect dependencies and cleanups (stale data, leaks),
and `StrictMode` runs effects twice in development so a missing cleanup shows up early. No pages, no API calls yet.

## Changes
- `frontend/package.json`: scripts `dev`, `build` (`tsc -b && vite build`), `preview`, `typecheck`, `lint`.
- `frontend/vite.config.ts`: React + Tailwind plugins, `@/` → `src/`, port 5173 with `strictPort` for both `dev`
  and `preview` (the API's CORS/CSRF/OAuth settings allow exactly `http://localhost:5173`; on 5174 or 4173 every
  request would fail).
- `frontend/tsconfig.json` + `tsconfig.app.json` + `tsconfig.node.json`: app code gets DOM types and no Node types
  (so `process.env` does not compile in browser code); `vite.config.ts` gets Node types. Strict, plus
  `noUncheckedIndexedAccess` like the backend.
- `frontend/eslint.config.js`: `@eslint/js` + `typescript-eslint` + `eslint-plugin-react-hooks` (recommended:
  Rules of Hooks, exhaustive deps, and the React Compiler rules such as `set-state-in-effect`, `refs`, `purity`).
- `.gitignore`: `.env.*` (except `.env.example`), because Vite reads `.env.production.local` and similar files.
- `frontend/index.html`, `src/main.tsx` (`StrictMode`), `src/App.tsx` (placeholder page), `src/index.css` (Tailwind).
- `frontend/src/lib/cn/`: `cn(...)` = `clsx` + `tailwind-merge`, used by the UI components in step 15.

## How to test
```bash
cd frontend && npm install
npm run dev        # open http://localhost:5173 → heading + amber "development" badge
npm run typecheck && npm run lint && npm run build
```
With the API running, the GitHub login from 13c now lands on a real page at `http://localhost:5173/`.

## How to reuse in another project
Copy `src/lib/cn/` and run `npm install clsx tailwind-merge`. Then:
```tsx
import { cn } from '@/lib/cn';
<button className={cn('rounded px-4 py-2', isPrimary && 'bg-blue-600 text-white', className)} />
```
The `@/` alias needs both `resolve.alias` in `vite.config.ts` and `paths` in `tsconfig.app.json`.

## Dependencies (all new)
`react`/`react-dom` 19.3.1, `clsx` 2.1.1, `tailwind-merge` 3.7.0; dev: `vite` 7.3.7, `@vitejs/plugin-react` 5.2.0
(6.x needs Vite 8), `tailwindcss` + `@tailwindcss/vite` 4.3.4, `typescript` 5.9.3, `eslint` 9.39.5, `@eslint/js`,
`typescript-eslint` 8.72.1, `eslint-plugin-react-hooks` 7.1.1, `globals`, `@types/*`. Installed with
`npm install --before=2026-11-04`: every package, including the transitive ones, is at least two weeks old (supply chain).
`npm audit` shows two advisories in dev-only tools (none in what ships to the browser; `npm audit --omit=dev` is clean):
picomatch ReDoS (high, via Vite; no fixed version exists yet) and minimatch (moderate, via typescript-eslint; the fix
is in 8.73.0, released 2 days ago). Both need a malicious glob pattern, and only our own config passes patterns. See Known gaps.

## Verification
- `npm run typecheck`, `npm run lint`, `npm run build`: no errors (JS 251 kB, 78 kB gzip: mostly React).
- Lint check: a temporary file with a conditional `useState` → error `rules-of-hooks`; a missing effect dependency →
  warning `exhaustive-deps` (file deleted).
- `npm run dev` → `curl` returns the page; the `@/lib/cn` import resolves; the Tailwind CSS contains the used classes.
  With port 5173 taken, Vite exits with "Port 5173 is already in use" (`strictPort`). `vite preview` → 200 on 5173.

## Review
- **security-reviewer (low), fixed:** `.gitignore` covered only `.env` and `.env.local`, but Vite also reads
  `.env.[mode]` and `.env.[mode].local`; a value in `frontend/.env.production.local` could be committed. Now `.env.*`
  is ignored, except `.env.example` (checked with `git status --ignored`).
- **code-reviewer (should-fix), fixed:** the ESLint comment said "Rules of Hooks + exhaustive deps", but v7
  `recommended` also turns on the React Compiler rules as errors (16 rules in total). The comment and PROGRESS now say so,
  with a note for steps 19, 24 and 25.
- **code-reviewer (nit), fixed:** `vite preview` used port 4173, which the API does not allow. Now 5173 + `strictPort`.
- Everything else was confirmed: localhost-only dev server, no source maps, no Node types in app code, lock file
  only from registry.npmjs.org with integrity hashes, install scripts only in `esbuild`/`fsevents`.

## Interview questions
1. **Why does `StrictMode` run effects twice in development?** It mounts, unmounts, and mounts again, so an effect
   without a cleanup (interval, listener, subscription) runs twice and the bug shows up. Production runs once.
2. **What does `exhaustive-deps` protect against?** An effect or `useCallback` that reads a value not in its
   dependency list keeps the old value (a stale closure): wrong data, or a request for the wrong ID.
3. **How do you lower supply-chain risk when adding npm packages?** A lock file, `npm ci` in CI, few dependencies,
   no versions published in the last days (`--before`), install scripts not run by default, `npm audit`.
