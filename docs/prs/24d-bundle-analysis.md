# PR 24d: Bundle analysis + react-router production build

## What and why
You cannot shrink a bundle you cannot see. `npm run analyze` builds the app and writes `stats.html`, a treemap of
every chunk and the packages inside it (with gzip sizes), so you can find the big ones. The first finding fixes a known
gap from 16a: `react-router`'s `package.json` sends every bundler to its DEVELOPMENT build, so production shipped its
dev warnings. `vite build` now uses its production build. goal.md: P2 (bundle size). First of the three bundle PRs
(24e `manualChunks`, 24f dynamic import).

**New dev dependency:** `rollup-plugin-visualizer` ^7.1.3 (approved for step 24; only used at build time).

## Changes
- `frontend/vite.config.ts`: with `--mode analyze`, adds `visualizer({ filename, gzipSize: true, open: true })`;
  `filename` is an absolute path next to `vite.config.ts`. Only in `vite build` (`command === 'build'`), aliases
  `react-router` and `react-router/dom` to `node_modules/react-router/dist/production/` with exact-match regexes (a plain `'react-router'` key would also
  match `'react-router/dom'`). The dev server keeps the dev build and its warnings.
- `frontend/package.json`: `"analyze": "vite build --mode analyze"`, the new dev dependency (+ lock file).

## How to test
```bash
cd frontend
npm run analyze        # builds, writes frontend/stats.html and opens it in the browser
```
Click a chunk to zoom in. The run overwrites `dist/` and does not load `.env.production*` (mode `analyze`), so run
`npm run build` again before deploying. `git status` does not show `stats.html` (already in `.gitignore`), and
`dist/` does not contain it. `npx vite build`, then `grep -c "Hey developer" dist/assets/*.js`: all 0 (before: 1).

## How to reuse in another project
```ts
// vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer';
export default defineConfig(({ mode }) => ({
  plugins: [react(), mode === 'analyze' && visualizer({ filename: 'stats.html', gzipSize: true, open: true })],
}));
// package.json: "analyze": "vite build --mode analyze"; add stats.html to .gitignore
```
For the react-router alias, copy the `aliases` block from `vite.config.ts` (React Router 7).

## Verification
- `npm run typecheck`, `npx eslint .`, `vite build`: OK.
- `diff` of `react-router/dist/development` vs `dist/production`: the only difference is
  `ENABLE_DEV_WARNINGS = true` vs `false`, so the swap changes no behaviour, only removes warnings.
- Main chunk: 395.09 → 393.38 kB (gzip 125.21 → 124.61 kB). The "Hey developer 👋" text is gone from `dist/`.
  The report lists only `react-router/dist/production` modules.
- `vite build --mode analyze` writes `stats.html` (252 kB) next to `vite.config.ts`. Run with the macOS `open`
  command hidden, the build failed with `spawn open ENOENT` AFTER writing the file. On Linux the `open` package uses
  its own `xdg-open` script, which usually fails silently, so CI should still pass. Run from the repo root
  (`vite build frontend --mode analyze`), the report still lands in `frontend/stats.html`.
- What the report shows (sizes BEFORE minification, so larger than the final chunks):

  | Package | Rendered | gzip |
  |---|---|---|
  | react-dom | 638 kB | 111 kB |
  | react-router | 219 kB | 48 kB |
  | zod | 217 kB | 55 kB |
  | react-hook-form | 110 kB | 20 kB |
  | tailwind-merge | 100 kB | 17 kB |
  | app code (`src/`) | 85 kB | 34 kB |
  | dompurify (only the `SecurityPage` chunk) | 82 kB | 22 kB |
  | sonner | 67 kB | 14 kB |

## Review
- **code-reviewer, nit (fixed):** the docs said `open: true` makes the build fail in CI. Only true when the launcher
  cannot start (the measured macOS case); on Linux the `open` package's own `xdg-open` script usually fails
  silently. Reworded here and in PROGRESS.
- **code-reviewer, nit (fixed):** `filename: 'stats.html'` was resolved against the cwd, not next to
  `vite.config.ts` as the comment said. Now an absolute path (`path.resolve(import.meta.dirname, 'stats.html')`).
- **code-reviewer, nit (fixed, docs):** `--mode analyze` does not load `.env.production*` and overwrites `dist/`.
  Noted in "How to test" and in PROGRESS.
- code-reviewer confirmed: exact-match aliases, build only, the `@` alias unchanged, no dev/prod copies mixed (the
  production files import only their own chunks; no other package depends on `react-router`), `PROD` still true in
  `analyze` mode. **security-reviewer:** no findings.

## Interview questions
1. **How do you find out why a bundle is big?** Generate a treemap (`rollup-plugin-visualizer` for Vite/Rollup,
   `webpack-bundle-analyzer` for webpack, or `source-map-explorer`) and look at gzip sizes, not raw ones. Then ask
   for each big box: is it needed on the first page (if not, lazy-load it), is it duplicated, is there a smaller
   alternative, is it the dev build?
2. **Why could a production bundle contain a library's development build?** Bundlers pick a file through the
   package's `exports` conditions. If a package has no `production` condition (React Router 7), the bundler takes the
   default, which can be the dev build. Vite's `resolve.alias` can point to the production file.
3. **Is it safe to deploy the report?** Do not: it lists source file paths and module sizes, which help an attacker
   map the app. It is written outside `dist/` and git-ignored.
