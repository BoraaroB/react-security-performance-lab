# PR 16b: Lazy-loaded pages with preload on hover/focus

## What and why
Until now the whole app was one JavaScript file, so the first visit downloaded the code of every page. Now pages
that are not needed for the first screen are their own file, downloaded only when opened (`React.lazy` +
`Suspense`), and a nav link starts that download when the user hovers or focuses it, so the click usually shows the
page at once. Goal topic: P2, bundle size and asset loading. Second half of step 16 (user's split).

## Changes
- `frontend/src/lib/lazy-with-preload/` (new portable module + README): `lazyWithPreload(load)` = `React.lazy` with a
  `preload()` method that only calls `load()` early (errors ignored). No own cache: the browser downloads a module
  once per page, so the render's `import()` reuses the download that hover started.
- `frontend/src/router/lazy-pages.ts` (new): the lazy pages, today only `ComponentsPage`. A separate file so the
  layout can import them for preloading (`routes.tsx` already imports the layout; importing back would be circular).
- `frontend/src/router/routes.tsx`: `ComponentsPage` comes from `lazy-pages.ts`. Layout, Home and 404 stay eager
  (in the main file): nearly every visit needs them for the first screen.
- `frontend/src/layouts/RootLayout.tsx`: `<Suspense>` with a `Spinner` around `<Outlet />` (the header stays visible
  while a page loads); `NAV_LINKS` has an optional `preload`, called on `onMouseEnter` and `onFocus`.
- `frontend/src/pages/ComponentsPage.tsx`: `export default function` (`React.lazy` needs a default export).

## How to test
```bash
cd frontend && npm run build && npx vite preview
```
Open http://localhost:5173 with DevTools → Network → JS. On load: only `index-*.js`. Hover "Components" →
`ComponentsPage-*.js` is downloaded. Hover again or click → no new request, the page opens at once. With
"Slow 3G" throttling, open `/components` directly: the spinner shows under the header until the file arrives.

## How to reuse in another project
Copy `src/lib/lazy-with-preload/` (only `react` is needed):
```tsx
const SettingsPage = lazyWithPreload(() => import('./pages/SettingsPage')); // default export
<Link to="/settings" onMouseEnter={SettingsPage.preload} onFocus={SettingsPage.preload}>Settings</Link>
<Suspense fallback={<Spinner />}><Outlet /></Suspense>
```

## Verification
- `npm run typecheck`, `npm run lint`, `npm run build`: no errors. Build: main file 349 → 347 kB, plus
  `ComponentsPage-*.js` (3.8 kB). The saving is small because today's lazy page is tiny; it grows with every big
  page added later (posts, admin, demos).
- `vite preview` + headless Chrome (`--dump-dom`): `/`, `/components`, `/nope` render the right `<h1>`.
- Headless Chrome over the DevTools protocol (temporary script): on load only the main file; hover on
  "Components" → `ComponentsPage-*.js` once; second hover → no request. With 600 ms network latency, hover +
  immediate click → still one request, and the page renders.
- Size: ~55 changed lines of code (plus a 39-line README).
- Second commit (user's review): `lazyWithPreload` lost its own promise cache (the browser's module map already
  shares one download), and Home + 404 went back to eager (lazy Home made a cold visit to `/` wait for two files
  one after the other, to save 0.6 kB).

## Review
- **security:** no findings.
- **code (nit), fixed:** the docs said a failed preload always lets the render try again. A download that fails
  while the page renders is cached by `React.lazy`; the docs now say so (handled in step 17).
- **code (nit), fixed in docs:** a second `import()` of a failed file may not re-download in every browser. The
  README says it depends on the browser; step 17 offers a reload instead of relying on a retry.
- **code (nit), fixed (second commit):** a lazy home page costs one extra request on a cold visit to `/`. Home is
  eager now.
- **code (nit), fixed:** the "Known gaps" entry about React Router's default error screen now also mentions
  chunk-load errors from lazy pages (they replace the whole layout with that screen until step 17).

Second commit, reviewed again:
- **security:** no findings.
- **code (nit), fixed:** without its own promise cache, the module shares only the module download (done by the
  browser). A custom loader with extra work (a fetch, a retry) would run once per `preload()` and once on render.
  The README now says `load` must be a plain `import()`.
- **code (nit), fixed:** the size was ~55 changed lines of code, not ~45.

## Interview questions
1. **What is code splitting and what does it cost?** The bundler puts each dynamic `import()` into its own file, so
   the first download is smaller. The cost: an extra request (a delay) when that code is first needed. Preloading on
   hover/focus hides most of that delay.
2. **Which pages should be lazy?** Not the ones nearly every visit needs for the first screen (layout, landing
   page): lazy there means a waterfall (main file, then the page file). Lazy pays off for big pages and for pages
   only some users see (admin, settings, charts).
3. **What happens when a lazy chunk fails to load (e.g. after a deploy removed the old file)?** `React.lazy` caches
   the error and throws it during render; an error boundary must catch it and offer a reload (step 17).
