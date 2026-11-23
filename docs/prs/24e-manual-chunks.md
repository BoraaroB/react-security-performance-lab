# PR 24e: Vendor chunk (`manualChunks`)

## What and why
Before this PR, React, React Router and the other always-loaded libraries were in the same entry chunk as our code
(393 kB, only ~16 kB of it ours). The file name has a content hash, so every deploy changed it and every user
downloaded all 393 kB again. Now the libraries are in their own `vendor-<hash>.js`. Its hash changes only when a
library is updated, so the browser keeps it cached across deploys and downloads only the small entry chunk.
goal.md: P2 (bundle size, asset loading). Second of the three bundle PRs (24f: dynamic `import()`).

## Changes
- `frontend/vite.config.ts`: `VENDOR_PACKAGES` (the libraries the entry chunk already loaded) and
  `build.rollupOptions.output.manualChunks(moduleId)`: a module from one of those packages goes to `vendor`. Rollup
  also moves everything those modules import (scheduler, cookie, set-cookie-parser) into `vendor`, which is why the
  vendor chunk imports nothing from our code. Other modules are placed as before. Lazy-only libraries (zod,
  react-hook-form, dompurify) are NOT in the list: a vendor chunk is loaded on the first page, so they would stop
  being lazy.

## How to test
```bash
cd frontend
VITE_API_ORIGIN=http://localhost:4000 npx vite build   # vendor-<hash>.js ~377 kB, entry index-<hash>.js ~16 kB
grep modulepreload dist/index.html                     # the vendor chunk is preloaded next to the entry
```
Then change any UI text (e.g. the `<h1>` in `src/pages/PerformancePage.tsx`), build again: the `index-*` names
change, `vendor-*` keeps the same name. Undo the text change.

## How to reuse in another project
```ts
// vite.config.ts (Vite 7 / Rollup). List only libraries the first page loads anyway.
const VENDOR_PACKAGES = ['react', 'react-dom', 'react-router'];
// .* = the LAST node_modules/ (pnpm: node_modules/.pnpm/react@19/node_modules/react/...)
const PACKAGE_NAME_IN_PATH = /.*node_modules\/((?:@[^/]+\/)?[^/]+)\//;
build: { rollupOptions: { output: { manualChunks(moduleId) {
  const match = PACKAGE_NAME_IN_PATH.exec(moduleId);
  if (match && VENDOR_PACKAGES.includes(match[1])) return 'vendor';
  return undefined;
} } } },
```
Check the result with `npm run analyze` (24d). Vite 8 (Rolldown) replaces `manualChunks` with chunk groups.

## Verification
- `npm run typecheck`, `npx eslint .`, `vite build`: OK. Two builds in a row give the same file names.

  | Chunk | Before | After |
  |---|---|---|
  | entry `index-*.js` | 393.38 kB (gzip 124.61) | 16.44 kB (gzip 6.40) |
  | `vendor-*.js` | – | 377.01 kB (gzip 118.33) |
  | zod + react-hook-form (lazy, shared) | 119.86 kB | 119.89 kB, still lazy |
  | `SecurityPage` (dompurify, lazy) | 38.92 kB | 38.96 kB, still lazy |

  First page: 124.61 kB gzip before, 124.73 kB after (two files instead of one; `modulepreload` fetches them in parallel).
- Hash test: changing one UI string changed every `index-*` name; `vendor-rVIGF7vT.js` stayed. A different
  `VITE_API_ORIGIN` also left the vendor name unchanged. The vendor chunk imports nothing (no cycle with the entry).
- The usual shortcut "everything from `node_modules` → vendor", measured: a 528 kB (gzip 166.88 kB) vendor chunk on the
  first page (+48.5 kB gzip), because zod, react-hook-form and dompurify are no longer lazy; Vite also warns (> 500 kB).
- `vite preview` + headless Chrome on `/performance`: the page renders, no console errors, no CSP reports.

## Review
- **code-reviewer, should-fix (fixed):** the regex took the FIRST `node_modules/` in the path. With pnpm
  (`node_modules/.pnpm/react@19/node_modules/react/...`) or a nested copy it found the wrong package name, so nothing
  went to `vendor`, silently. Now `.*` in front picks the last one (checked with a pnpm-style path). Same build output.
- **code-reviewer, should-fix (fixed, docs):** "every other module is placed as before" was wrong: Rollup also moves
  the static dependencies of vendor modules into `vendor`. Explained here and in PROGRESS; `scheduler` removed from
  the list (react-dom brings it; the build is byte-identical, `vendor-rVIGF7vT.js`).
- **code-reviewer, nit (fixed):** the known gap now says "a library our code imports directly".
- **security-reviewer:** no findings (same-origin chunk fits `script-src 'self'`, sourcemaps still off, the caching
  advice limits `immutable` to hashed `/assets/*`).

## Interview questions
1. **Why split vendor code from app code?** Long-term caching: file names contain a content hash, so a file that did
   not change keeps its name and the browser (or CDN) serves it from cache. Libraries change far less often than app
   code, so after a deploy users download only the small app chunk.
2. **Why not put all of `node_modules` in the vendor chunk?** The vendor chunk loads on the first page. Libraries that
   only lazy pages use would then load up front (measured here: +48.5 kB gzip). Group only what the entry needs anyway.
3. **Does this make the first visit faster?** No, about the same bytes (one more request, preloaded in parallel). It
   makes the visits after a deploy faster. Real caching also needs `Cache-Control: max-age=31536000, immutable` on
   `/assets/*` from the server (step 32, nginx).
