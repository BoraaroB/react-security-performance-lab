# PR 16a: React Router with a shared layout and a 404 page

## What and why
The app gets real URLs: `/` (home), `/components` (the UI showcase, moved from `App.tsx`) and a 404 page for every
other path. A shared layout keeps the header and navigation mounted while only the page below it changes. This is the
base for the lazy-loaded pages in 16b (goal P2: bundle size and loading): React Router alone grows the bundle from
255 kB to 349 kB, and 16b starts loading pages only when they are needed. First half of step 16 (user's split).

## Changes
- `frontend/package.json`: `react-router@^7.18.5` (installed with `--before`, see Decisions in PROGRESS).
- `frontend/src/router/routes.tsx`: route config (`RouteObject[]`): the layout route has the pages as children,
  plus a `*` catch-all for 404. Step 21 adds the protected groups here.
- `frontend/src/router/paths.ts`: `PATHS` (every URL once, `as const`); links use `PATHS.home`, not `'/'`.
- `frontend/src/router/index.ts`: `createBrowserRouter(routes)` at module level.
- `frontend/src/layouts/RootLayout.tsx`: header with `NavLink`s (`end`, active color; React Router sets `aria-current="page"`) and `<Outlet />`.
- `frontend/src/main.tsx`: renders `<RouterProvider router={router} />` instead of `<App />`.
- `frontend/src/pages/ComponentsPage.tsx`: the former `App.tsx` (renamed; its own `<h1>`, `<main>` moved to the layout).
- `frontend/src/pages/HomePage.tsx`, `NotFoundPage.tsx`: small pages; the 404 page does not echo the path.

## How to test
```bash
cd frontend && npm run dev
```
Open http://localhost:5173: "Home" is blue. Click "Components": the URL changes without a full page reload
(DevTools → Network shows no new document request) and the header stays in place. Open
http://localhost:5173/anything → "Page not found" with a link home. Reload on `/components` → the same page
(the dev server answers every path with `index.html`; the router picks the page in the browser).

## How to reuse in another project
`npm install react-router`. Copy the shape of `src/router/` (`paths.ts`, `routes.tsx`, `index.ts`), not the pages:
```tsx
const router = createBrowserRouter([
  { path: '/', element: <Layout />, children: [
    { index: true, element: <Home /> },
    { path: '*', element: <NotFound /> },
  ] },
]);
createRoot(el).render(<RouterProvider router={router} />); // RouterProvider from 'react-router/dom'
```

## Verification
- `npm run typecheck`, `npm run lint`, `npm run build`: no errors (CSS 14.7 kB, JS 349 kB, was 255 kB).
- `vite preview` + `curl`: `/`, `/components`, `/does-not-exist` all → 200 `text/html` (single-page app fallback).
- Headless Chrome (`--dump-dom`) on the same paths: the right `<h1>` on each page, `aria-current="page"` on the
  active link only, no active link on the 404 page.
- `npm audit --omit=dev`: 0 vulnerabilities. New packages: `react-router`, `cookie`, `set-cookie-parser`.
  Size: ~115 changed lines of code.
- Second commit (user's request): router moved from `src/app/` to `src/router/` (`index.ts`, `routes.tsx`,
  `paths.ts`), layout to `src/layouts/`. Typecheck, lint, build and the headless Chrome check re-run: same results.

## Review
- **security (low), postponed to step 17:** no `errorElement`, so React Router's default error screen shows the
  error message and the stack to the user, in production too. Step 17 adds the error UI; in "Known gaps".
- **code (should-fix), fixed in docs:** React Router's `package.json` exports only its development build, so the
  dev hint and dev warnings also ship in the production bundle (checked: "Hey developer" is in `dist/`). The gap text
  was corrected; aliasing to the production build is a "Known gaps" item for step 24 (same size, so no hurry).
- **code (nit), fixed:** hovering the active link turned it gray (`tailwind-merge` keeps `hover:` next to the
  active color). Now `isActive ? 'text-blue-700' : 'text-gray-600 hover:text-gray-900'`.
- **code (nit), left to the user:** CLAUDE.md's structure tree does not list the new frontend folders
  (now `src/router/` and `src/layouts/`, after the second commit). CLAUDE.md is the user's instruction file, so it was not edited in this PR.

## Interview questions
1. **Why does a single-page app return 200 for a URL that does not exist?** The server sends `index.html` for every
   path and the router decides in the browser. It is a "soft 404": search engines and monitoring see 200. Fixes:
   server rendering, a list of known paths on the server, or `noindex` on the 404 page.
2. **Why create the router outside of a component?** A router created during render is rebuilt on every render
   (state lost, effects re-run). Module level means one instance for the app's lifetime.
3. **Is hiding a nav link or a route a security measure?** No. The JavaScript bundle can be read by anyone and the
   API can be called directly; the server enforces authorization (step 12). Route guards (step 21) only improve the UX.
4. **Why are the routes TypeScript objects and not JSON?** JSON cannot hold a component or a `lazy(() => import())`,
   so it would need a string → component map checked only at runtime, and Vite could not split pages into chunks.
   JSON routes only make sense when the server decides them (a CMS).
