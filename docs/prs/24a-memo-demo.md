# PR 24a: memo, useMemo and useCallback demo

## What and why
When a component re-renders, React re-renders all of its children too, even when their props look the same. This PR
adds a public `/performance` page (lazy, like `/security`) with three lists that each show a live render counter:
no `memo`, `memo` with new props on every render, and `memo` + `useMemo` + `useCallback`. Clicking "Re-render this
card" shows that only the third list stays still. goal.md: P1 (React rendering). First of the four step-24 PRs
(24b `useDeferredValue`, 24c `VirtualList`, 24d bundle analysis + manualChunks + dynamic import). No new dependencies.

## Changes
- `frontend/src/features/performance-demo/ProductList.tsx`: a list (first 6 of the matches) with a render counter, plus
  `MemoProductList = memo(ProductList)`. The counter is an effect without a dependency array that writes to a DOM
  node through a ref; a `setState` there would cause another render and count itself forever.
- `frontend/src/features/performance-demo/MemoDemo.tsx`: 5,000 products built once at module load, a filter input,
  a "Re-render this card" button, and the three lists. `filterProducts(query)` runs plain (new array on every render)
  and inside `useMemo` (same array until `query` changes); `useCallback` keeps one `onSelect` function.
- `frontend/src/pages/PerformancePage.tsx`: new lazy page.
- `frontend/src/router/{paths,lazy-pages,routes}.ts(x)`, `frontend/src/layouts/RootLayout.tsx`: `/performance`
  route and a "Performance" nav link (preloaded on hover/focus).

## How to test
`cd frontend && npm run dev`, open http://localhost:5173/performance (no backend or login needed). Expected:
1. On load every counter shows `Renders: 2` (StrictMode mounts twice in development; `npm run build && npm run preview` shows 1).
2. "Re-render this card": lists 1 and 2 go up by one, list 3 does not change.
3. Click a product that is not selected yet (sets "Selected" in the parent): same result as step 2. Clicking the
   selected one again changes nothing: React skips a `setState` with an equal value.
4. Type in the filter: all three go up, because the filtered array really changed (memo must not hide real changes).

## How to reuse in another project
Nothing to copy: the patterns are plain React.
```tsx
const MemoList = memo(List);                                   // skip renders when props are the same objects
const items = useMemo(() => filterItems(query), [query]);      // same array until query changes
const onSelect = useCallback((id: string) => setSelected(id), []); // same function on every render
<MemoList items={items} onSelect={onSelect} />
```
With React Compiler (`babel-plugin-react-compiler`), React adds this memoization at build time. This project does not
use it, so the difference stays visible.

## Verification
- `npm run typecheck`, `npx eslint src` (react-hooks 7 with the compiler rules), `vite build`: OK.
  `PerformancePage` is its own chunk (2.6 kB, 1.2 kB gzip); the main chunks did not change.
- Headless Chrome (CDP script against the dev server): load → `2 | 2 | 2`; "Re-render this card" → `3 | 3 | 2`;
  click "Product 1" → `4 | 4 | 2` and "Selected: Product 1"; type `42` → `5 | 5 | 3` (199 matches in each list).

## Review
- **code-reviewer, nit (fixed):** test step 3 only works when you click a product that is not selected yet (React
  skips a `setState` with an equal value). The step now says so.
- **code-reviewer, nit (fixed):** interview Q3 did not say why the counter reaches 2 instead of going back to 1
  (StrictMode's remount is simulated: refs and state are kept). Added.
- **code-reviewer, nit (fixed):** the `PRODUCTS` comment now says why 5,000 items (filtering is real work).
- **code-reviewer, nit (fixed by the browser check):** "were not checked in a browser by me" was replaced with the
  headless Chrome results in Verification.
- code-reviewer confirmed the expected behavior from React and React Router source (the counter is right under
  StrictMode; the page does not re-render when the session check finishes). security-reviewer: no findings (no
  HTML sinks, `textContent` only, no API calls, public route like `/security`).

## Interview questions
1. **Does `memo` alone stop a child from re-rendering?** Only if every prop is the same (`Object.is`) as last time.
   An inline arrow function or a `.filter()` result is a new object on every render, so `memo` sees a change
   (list 2). `useCallback` / `useMemo` keep the same object until a dependency changes (list 3).
2. **Should you wrap everything in `memo`/`useMemo`?** No. Each one costs a props/deps comparison and memory, and makes
   the code harder to read. Use them when a profiler shows a slow component re-rendering for nothing, when an
   expensive calculation repeats, or when a value is a dependency of an effect or a prop of a `memo` child.
   React Compiler does it automatically where it is safe.
3. **Why do the counters start at 2 in development?** `StrictMode` mounts, unmounts and mounts each component again to
   find effects without cleanup. The remount is simulated: React keeps state and refs and only runs the effects (and
   their cleanups) again, so the counter's ref goes 1 → 2 instead of back to 1. Production mounts once.
