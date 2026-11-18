# PR 16b: Lazy-loaded pages with preload on hover/focus

## What and why
Until now the whole app was one JavaScript file, so the first visit downloaded the code of every page. Now each page
is its own file, downloaded only when it is opened (`React.lazy` + `Suspense`), and a nav link starts that download
when the user hovers or focuses it, so the click usually shows the page at once. Goal topic: P2, bundle size and
asset loading. Second half of step 16 (user's split).

## Changes
- `frontend/src/lib/lazy-with-preload/` (new portable module + README): `lazyWithPreload(load)` = `React.lazy` with a
  `preload()` method. The download is started once and shared by `preload()` and the render; a preload that failed
  before the render is forgotten (and its error ignored), so the render calls `import()` again.
- `frontend/src/router/pages.ts` (new): the three pages as lazy components. A separate file so the layout can import
  them for preloading (`routes.tsx` already imports the layout; importing back would be circular).
- `frontend/src/router/routes.tsx`: imports the lazy pages instead of the page files. The layout stays eager.
- `frontend/src/layouts/RootLayout.tsx`: `<Suspense>` with a `Spinner` around `<Outlet />` (the header stays visible
  while a page loads); each nav link calls `page.preload` on `onMouseEnter` and `onFocus`.
- `frontend/src/pages/*.tsx`: `export default function` (`React.lazy` needs a default export).

## How to test
```bash
cd frontend && npm run build && npx vite preview
```
Open http://localhost:5173 with DevTools → Network → JS. On load: `index-*.js`, `HomePage-*.js`, `Card-*.js`.
Hover "Components" → `ComponentsPage-*.js` is downloaded. Hover again or click → no new request, the page opens
at once. With "Slow 3G" throttling and no hover (open `/components` directly), the spinner shows under the header.

## How to reuse in another project
Copy `src/lib/lazy-with-preload/` (only `react` is needed):
```tsx
const SettingsPage = lazyWithPreload(() => import('./pages/SettingsPage')); // default export
<Link to="/settings" onMouseEnter={SettingsPage.preload} onFocus={SettingsPage.preload}>Settings</Link>
<Suspense fallback={<Spinner />}><Outlet /></Suspense>
```

## Verification
- `npm run typecheck`, `npm run lint`, `npm run build`: no errors. Build: main file 349 → 346 kB, plus one file per
  page (`HomePage` 0.6 kB, `ComponentsPage` 3.9 kB, `NotFoundPage` 0.4 kB) and a shared `Card` chunk. The saving is
  small because today's pages are tiny; it grows with every page added later (posts, admin, demos).
- `vite preview` + headless Chrome (`--dump-dom`): `/`, `/components`, `/nope` render the right `<h1>`.
- Headless Chrome over the DevTools protocol (temporary script): after load only the home page chunk; hover on
  "Components" → `ComponentsPage-*.js` once; second hover and the click → no request, `<h1>` = "UI components".
- Size: ~45 changed lines of code (plus a 37-line README).

## Review
- **security:** no findings.
- **code (nit), fixed:** the docs said a failed preload makes the render try again. True only for a preload that
  failed BEFORE the render; if the user clicks while the hover download is still running and it fails, `React.lazy`
  caches that error. README, comment, PROGRESS and this description now say so.
- **code (nit), fixed in docs:** a second `import()` of a failed URL may not re-download in every browser (older
  spec rules cache failed module fetches). The README now says it depends on the browser; step 17 handles retries.
- **code (nit), fixed in docs:** the home page is lazy too, so a cold visit to `/` needs one extra request (main
  file first, then `HomePage-*.js`). The trade-off is now in PROGRESS and interview question 2.
- **code (nit), fixed:** the "Known gaps" entry about React Router's default error screen now also mentions
  chunk-load errors from lazy pages (they replace the whole layout with that screen until step 17).

## Interview questions
1. **What is code splitting and what does it cost?** The bundler puts each dynamic `import()` into its own file, so
   the first download is smaller. The cost: an extra request (a delay) when that code is first needed. Preloading on
   hover/focus hides most of that delay.
2. **Why is the layout not lazy?** It is shown on every page; making it lazy would only add a request in front of
   every first render. Split what is not needed for the first screen. The same argument applies to the landing
   page: here the home page is lazy too, which costs one extra request on a cold visit to `/`; a bigger app might
   keep its landing page eager.
3. **What happens when a lazy chunk fails to load (e.g. after a deploy removed the old file)?** `React.lazy` caches
   the error and throws it during render; an error boundary must catch it and offer a reload (step 17).
