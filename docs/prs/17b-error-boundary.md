# PR 17b: ErrorBoundary for parts of a page + one place to log render errors

## What and why
Step 17a replaced a whole page that crashed. A page often has independent parts (a posts list, a stats widget):
one broken part should not take the rest down. `ErrorBoundary` wraps one part and shows a fallback with a
"Try again" button there. React 19's `createRoot` options `onCaughtError` / `onUncaughtError` give ONE place
where every render error is logged (later: an error-tracking service). Topic: developer experience / observability.

## Changes
- `frontend/src/components/feedback/ErrorBoundary/ErrorBoundary.tsx`: class component (`getDerivedStateFromError`), `fallback({ error, reset })` render prop; it does not log.
- `frontend/src/components/feedback/ErrorBoundary/index.ts` + `README.md`: public API, usage, what it does not catch.
- `frontend/src/main.tsx`: `createRoot(root, { onCaughtError, onUncaughtError })` logs the error + component stack.
- `frontend/src/pages/ComponentsPage.tsx`: demo card with a `BrokenWidget` that throws during render after a click.

## How to test
```bash
cd frontend && npm run dev
```
Open http://localhost:5173/components → "Break this widget". Only that card shows "This widget could not be shown"
(no error message on screen); the header and the other cards stay. The console shows one
`Render error (caught by a boundary): Error: BrokenWidget failed to render` line with the component stack.
"Try again" brings the widget back.

## How to reuse in another project
Copy `src/components/feedback/ErrorBoundary/` (needs only `react`).
```tsx
<ErrorBoundary fallback={({ reset }) => <button onClick={reset}>Try again</button>}>
  <PostsWidget />
</ErrorBoundary>

createRoot(el, { onCaughtError: (e, info) => report(e, info.componentStack) });
```

## Verification
- `npm run typecheck`, `npx eslint .`: pass. `vite build`: pass; main file 347 → 349 kB (the `createRoot` options),
  `ComponentsPage` chunk 3.8 kB (the boundary is only in the lazy page that uses it).
- Portability grep: no hits.
- Headless Chrome (dev server, CDP script): break → fallback only in the card, nav + `h1` still there, error text not
  on screen; console has exactly one `onCaughtError` line; "Try again" → widget back, fallback gone.

## Review
- code-reviewer, should-fix: the known gap "Route errors are logged twice" in `docs/PROGRESS.md` said `RouterProvider`
  has no `onError` prop; react-router 7.18 has one. **Fixed** the text. The prop is not used: `onCaughtError` stays
  the one place to log, so a route error still shows React Router's own console line too (known gap).
- code-reviewer, nit: the `main.tsx` comment said the options only replace console logging; a custom `onUncaughtError`
  also stops React from firing the `window` `error` event (which error trackers listen to). **Fixed** the comment.
- security-reviewer: no findings.

## Interview questions
1. **What does an error boundary NOT catch?** Errors in event handlers, `setTimeout`, and promises (`fetch`), and
   errors in the boundary itself. Only errors during render, lifecycle methods and effects of its children.
2. **Why is it still a class in React 19?** Only class components have `getDerivedStateFromError` /
   `componentDidCatch`; there is no hook for it. Libraries like `react-error-boundary` wrap the same class.
3. **What do `onCaughtError` / `onUncaughtError` add?** One central place to report every render error (the boundary
   that caught it does not need its own logging), with the component stack. Uncaught = no boundary, React unmounts the app.
