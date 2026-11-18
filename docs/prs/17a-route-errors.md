# PR 17a: Route error page (render and chunk-load errors)

## What and why
Until now, a page that threw while rendering showed React Router's built-in error screen. That screen shows the
error message and the full stack trace, in production too, which breaks the "no stack traces to the user" rule. Since
16b, a lazy page whose JS file fails to download (offline, or a new deploy removed the old file) ended up on the same screen,
and the header disappeared with it. This PR adds the router's `errorElement`: a safe, friendly error page with a
"Reload" button and its own text for chunk-load errors. Topic: bundle loading (P2) and not leaking internals (S3).
First part of step 17 (17a / 17b ErrorBoundary + React 19 root callbacks / 17c toasts).

## Changes
- `frontend/src/pages/RouteErrorPage.tsx`: the error page. Reads the error with `useRouteError()`, never renders its
  message or stack, recognizes chunk-load errors by the browser's message (`CHUNK_LOAD_ERROR`), offers
  "Reload the page" and a link home.
- `frontend/src/router/routes.tsx`: two `errorElement`s. A **pathless route** (no `path`, so no URL of its own) wraps
  all pages: a page error renders inside the layout and the header stays. The layout route has its own one, for errors
  in `RootLayout` itself.

Why "Reload" and not "Try again": `React.lazy` remembers a failed `import()` forever, so only a full page load
downloads the file again (and gets the new deploy's file names). No automatic reload: when the server is down, it
would loop. The home link works without a reload: React Router clears the error when the URL changes.

## How to test
```bash
cd frontend && npm run build
rm dist/assets/ComponentsPage-*.js      # simulate "the file is gone after a deploy"
npm run preview                          # open http://localhost:5173/components
```
Expected: header stays, "This page could not be loaded", a Reload button. Rebuild afterwards (`npm run build`).
For a render error: add `throw new Error('boom')` at the top of `ComponentsPage`, then `npm run dev` and open
`/components`: "Something went wrong", "boom" is only in the console. Remove the line again.

## How to reuse in another project
Not a portable module (it uses this app's `PATHS` and router). The pattern to copy with React Router 7 data mode:
```tsx
{ path: '/', element: <Layout />, errorElement: <ErrorPage />, children: [
  { errorElement: <ErrorPage />, children: [ /* pages */ ] },   // pathless: keeps the layout
] }
```
In `ErrorPage`: `const error = useRouteError()`; show a generic text, never `error.message` or `error.stack`.

## Verification
- `npm run typecheck`, `npm run lint`, `npm run build`: pass. Main file 348.6 kB (was 347 kB).
- Headless Chrome against `vite preview` (production build):
  - chunk file deleted → `/components` shows "This page could not be loaded" with the header;
  - temporary `throw` in `ComponentsPage` → "Something went wrong" with the header, the message is not in the DOM;
  - temporary `throw` in `RootLayout` → "Something went wrong" from the layout route's `errorElement`;
  - after the page error, clicking "Go to the home page" → `/` renders normally (no reload).
  The temporary throws were reverted.

## Review
- **security-reviewer:** no findings (checked: no message/stack rendered, no reload loop, fixed home link, regex has no ReDoS risk).
- **code-reviewer:**
  - should-fix, fixed: in `docs/PROGRESS.md` the 17a decision was inserted inside the 16b bullet (the 16b build-size line ended up under 17a).
  - nit, fixed: the 16a decision still pointed to the removed Known gap; it now says 17a added the `errorElement`.
  - nit, postponed: when a server answers a missing chunk with `index.html` (SPA fallback), Safari may report a MIME-type
    error that `CHUNK_LOAD_ERROR` does not match, so the user sees the generic text (Reload still works). Not tested, so no
    guessed message was added to the regex; step 32 (nginx) should answer missing `/assets/*` with 404. Added to Known gaps.

## Interview questions
1. **Why not show `error.message` on the error page?** It can contain internals (file names, data, API details) and does
   not help the user. Log it (console now, a central `onCaughtError` in 17b) and show a generic text.
2. **What is a chunk-load error and why does it happen after a deploy?** Lazy pages are separate files with a content hash
   in the name. A tab opened before the deploy still asks for the old file name; if the server no longer has it, `import()`
   fails. The fix is a full reload (new `index.html` → new file names), or keeping old assets for a while.
3. **What does an error boundary NOT catch?** Errors in event handlers, async code (`setTimeout`, promises, `fetch`),
   and errors thrown in the boundary itself. Those need `try/catch` or promise handling (steps 18, 19, 17c).
