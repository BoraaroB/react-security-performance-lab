# PR 24f: Dynamic `import()` on click

## What and why
Lazy pages (16b) load code when the user opens a page. Some code is needed even later: only when the user clicks
something. A dynamic `import()` inside the click handler loads it at that moment, so users who never click never
download it. The demo: a new card on `/performance` previews sanitized HTML, and DOMPurify loads on the first click.
goal.md: P2 (bundle size, asset loading). Last of the three bundle PRs (24d analyzer, 24e vendor chunk).

## Changes
- `frontend/src/features/performance-demo/DynamicImportDemo.tsx`: textarea + "Preview sanitized HTML" button. The
  handler runs `await import('@/lib/sanitize')`, measures how long the `import()` took, and renders the sanitized
  preview. The button shows a spinner while loading. If the download fails (offline, or a deploy removed the old
  chunk), an error `Alert` asks the user to reload.
- `frontend/src/pages/PerformancePage.tsx`: fourth card.

Because `SecurityPage` still imports `@/lib/sanitize` statically, Rollup now puts DOMPurify into one shared chunk
that both pages use, instead of copying it into each.

## How to test
```bash
cd frontend
VITE_API_ORIGIN=http://localhost:4000 npx vite build && npx vite preview   # http://localhost:5173/performance
```
DevTools → Network → JS. On load, no DOMPurify file. First click on "Preview sanitized HTML": one more file
(`index-<hash>.js`, ~31 kB), and `onerror` is gone from the preview. Second click: no request, `import()` ~1 ms.
Error path: reload the page (do not open the Security page first, it loads the same file), switch Network →
Offline, then click: the error message appears and the button is clickable again.

## How to reuse in another project
```ts
async function onExportClick() {
  // A string literal: the bundler needs to see the path at build time to make a separate chunk.
  const { exportToCsv } = await import('./heavy-export');
  exportToCsv(rows);
}
```
Wrap it in `try/catch`: the download can fail, and an event handler error reaches no error boundary.

## Verification
- `npm run typecheck`, `npx eslint .`, `vite build`: OK.

  | Chunk | Before | After |
  |---|---|---|
  | `PerformancePage` | 6.14 kB | 7.65 kB (gzip 3.05), only `import("./index-….js")` |
  | `SecurityPage` | 38.92 kB (with DOMPurify) | 8.31 kB + the shared chunk |
  | shared DOMPurify chunk | – | 30.67 kB (gzip 11.75) |
  | entry / `vendor` | 16.44 / 377.01 kB | 16.58 / 377.01 kB (`vendor-rVIGF7vT.js` unchanged) |

- Headless Chrome on `vite preview`, with a DevTools Protocol script that records every JS request: the page load does
  not request the DOMPurify chunk. Click 1 requests it (`import()` 9.7 ms on localhost) and the preview is
  `<p>Hello <b>bold</b> text.</p><img src="x">`. Click 2 requests nothing (0.9 ms). No console errors or CSP reports.
- Offline before the first click: the error `Alert` shows, the button is not stuck, there is no preview. Chrome tried
  the download again on the second click.

## Review
- **code-reviewer, should-fix (fixed):** the `try` also wrapped `sanitizeHtml(html)`, so a sanitizer error (it
  throws without a DOM) would have been shown as "Could not load the sanitizer… check your connection". Now only the
  `import()` is inside `try`; sanitizing runs after it, in its own named step (no nested call).
- **code-reviewer, should-fix (fixed, docs):** "Network → Offline, then a reload" could not work (an offline reload
  cannot load the page). The test steps now go offline after the page has loaded.
- **code-reviewer, nit (fixed):** the `PerformancePage` comment now mentions on-demand code loading.
- **security-reviewer:** no findings.

## Interview questions
1. **`React.lazy` vs. a plain dynamic `import()`?** Both split code with `import()`. `React.lazy` is for components
   and works with Suspense and error boundaries. A plain `import()` in an event handler is for anything else (a
   library, a function); you handle the loading state and errors yourself.
2. **What does the second `import()` of the same module cost?** No download: the browser's module map keeps one
   instance per URL, so the promise resolves at once. Two clicks during the download share the same request.
3. **Why must the path be a string literal?** The bundler decides the chunks at build time. `import(variable)` cannot
   be analyzed (Vite only supports simple template patterns), so the module would not get its own chunk.
