# PR 24b: useDeferredValue demo

## What and why
A slow component next to an input makes typing lag: every keystroke waits for the slow render. `useDeferredValue`
lets React update the input first and render the slow part in the background with the newer value (a new keystroke
interrupts that render). It does not make the slow part faster; it changes the order. This PR adds a second card to
`/performance` with a deliberately slow list (~250 ms per render) and a checkbox to compare both ways.
goal.md: P1 (React rendering). Second of the four step-24 PRs. No new dependencies.

## Changes
- `frontend/src/features/performance-demo/SlowList.tsx`: `SlowList` (memo) renders 250 `SlowRow`s; each row does
  ~1 ms of pure CPU work (a `Math.sqrt` loop). Many small rows on purpose: React can pause a background render only
  between components. `memo` is required: without it the list re-renders with the parent on every keystroke, and
  deferring saves nothing.
- `frontend/src/features/performance-demo/DeferredDemo.tsx`: input + checkbox. The list gets `deferredQuery` (checked)
  or `query` (unchecked), and is dimmed while it shows old results (`listQuery !== query`).
- `frontend/src/pages/PerformancePage.tsx`: adds the card.

## How to test
`cd frontend && npm run dev`, open http://localhost:5173/performance, card "useDeferredValue":
1. Uncheck "Use useDeferredValue" and type quickly: letters appear with a delay, in bursts.
2. Check it and type quickly: letters appear at once, the list is dimmed and catches up when you pause.
DevTools → Performance shows long tasks in case 1 and short ones in case 2. The dev build is slower
(StrictMode renders twice), so `npm run build && npm run preview` gives the realistic numbers.

## How to reuse in another project
Nothing to copy: the pattern is plain React 18+.
```tsx
const deferredQuery = useDeferredValue(query);
const isStale = deferredQuery !== query;
<input value={query} onChange={(e) => setQuery(e.target.value)} />
<div style={{ opacity: isStale ? 0.5 : 1 }}>
  <SlowResults query={deferredQuery} />   {/* must be memo(), or it re-renders with the input anyway */}
</div>
```

## Verification
- `npm run typecheck`, `npx eslint src`, `vite build`: OK. `PerformancePage` chunk 4.0 kB (was 2.6 kB).
- Headless Chrome (CDP), 5 quick keystrokes, time until the page answers again after each one:

  | Build | Without useDeferredValue | With useDeferredValue |
  |---|---|---|
  | `vite preview` (production, two runs) | 230–590 ms per key | 11–16 ms per key |
  | dev server | ~1,150 ms per key | 12–19 ms per key |

  With deferring, the list still showed `""` right after typing and `"abcde"` after a pause.
- Two things found while measuring: (1) a clock-based busy wait (`performance.now()`) fails `react-hooks/purity`,
  so the slow row does pure math instead; (2) the production build REMOVED that math while its result was unused
  (Rollup drops side-effect-free calls whose result is ignored; the chunk had no `sqrt`, no lag). The row now puts
  the result in `data-checksum`.

## Review
- **code-reviewer, should-fix (fixed):** nothing said WHY the slowness is split into 250 rows of ~1 ms. React's
  background render yields only between components (`workLoopConcurrentByScheduler`, ~5 ms slices), so one 250 ms
  component would freeze the input again even with `useDeferredValue`. Comment in `SlowList.tsx` + interview Q4.
- **code-reviewer, nit (fixed):** the one-use helper `simulateExpensiveWork` is inlined into `SlowRow` (the sum is
  used by `data-checksum`, so there is no unused variable).
- code-reviewer confirmed the `isStale` logic in both checkbox states and the explanations. security-reviewer: no
  findings (query only as escaped JSX text, no network/storage, the CPU cost is fixed and only affects the
  visitor's own tab).

## Interview questions
1. **`useDeferredValue` vs debounce?** Debounce waits a fixed time before doing anything, even on a fast device.
   `useDeferredValue` starts at once, renders in the background, and drops a render when a newer value arrives, so
   fast devices update almost instantly and slow ones stay responsive. Debounce is still the right tool for network
   requests (fewer calls); `useDeferredValue` does not reduce the number of requests.
2. **`useDeferredValue` vs `useTransition`?** Same mechanism (a low-priority render). `useTransition` wraps the state
   update (`startTransition(() => setX(...))`) when you own the setter; `useDeferredValue` wraps a value, e.g. a
   prop you receive.
3. **Why must the slow child be `memo`?** The parent re-renders on each keystroke with the new `query`. Without
   `memo` the child re-renders in that urgent render too, even though its deferred prop has not changed yet.
4. **Does it help if ONE component takes 250 ms?** No. React checks for newer work (a keystroke) only between
   components, about every 5 ms; one component's render cannot be paused in the middle. The demo works because the
   cost is spread over 250 rows of ~1 ms. One huge component needs splitting, a Web Worker, or less work (24c: virtualization).
