# PR 25c: Memory leak demo: a cache that grows forever, found with a heap snapshot

## What and why
A cache in a module-level `Map` lives as long as the page. When its keys keep changing (a new search, a new page, a
timestamp in the URL), entries are only added and never removed, so the memory grows until the tab gets slow or
crashes. No timer or listener is involved, so this leak is easy to miss in a code review. This PR adds a demo card
with an unbounded cache and a bounded one (at most 5 entries, oldest removed first), and step-by-step instructions
for finding the leak with a DevTools heap snapshot. goal.md: P3 (memory leaks). Last of three leak PRs (25a
interval, 25b listener).

## Changes
- `frontend/src/features/performance-demo/CacheLeakDemo.tsx`: a `Report` class (1 MB `Float64Array` each; a class
  so the heap snapshot shows it by name), two module-level Maps (`unboundedCache`, `boundedCache` with
  `BOUNDED_CACHE_LIMIT = 5`), buttons that add 10 reports to either cache or clear both, the cache sizes, and the
  heap snapshot steps.
- `frontend/src/pages/PerformancePage.tsx`: seventh card.

## How to test
```bash
cd frontend
npm run dev    # http://localhost:5173/performance, card "Memory leak: a cache that grows forever"
```
Click "Add 10 reports to the unbounded cache" 3 times: 30 reports (~30 MB). Click the bounded one 3 times: it stays
at 5. Then follow the heap snapshot steps on the card (DevTools → Memory → Heap snapshot, view "Comparison", class
filter `Report`, Retainers panel). Use the dev server: the production build renames the `Report` class and the `unboundedCache` variable.

## How to reuse in another project
Nothing to copy (no portable module in this step). The pattern for any cache:
```ts
cache.set(key, value);
if (cache.size > LIMIT) {
  const oldestKey = cache.keys().next().value; // a Map keeps insertion order
  if (oldestKey !== undefined) cache.delete(oldestKey);
}
```

## Verification
- `npm run typecheck`, `npx eslint src`, `vite build`: OK. `PerformancePage` chunk 11.34 → 13.76 kB, `vendor-rVIGF7vT.js` unchanged.
- Headless Chrome, a DevTools Protocol script that clicks the buttons and takes real heap snapshots
  (`HeapProfiler.takeHeapSnapshot`, which runs the garbage collector first):

  | Phase | Card shows | `Report` objects in the snapshot | 1 MiB buffers |
  |---|---|---|---|
  | start | 0 / 0 | 0 | 0 |
  | unbounded × 3 | 30 / 0 | 30 | 30 |
  | bounded × 3 | 30 / 5 | 35 | 35 |
  | clear | 0 / 0 | 0 | 0 |

  The snapshot has the edge `system / Context --unboundedCache--> Map`, the retainer path that the card describes.
- `vite preview` (production, `VITE_API_ORIGIN` set): same numbers on the card, no console errors. The snapshot
  finds 0 objects named `Report` there (the minifier renamed the class), which is why the card says to use the dev server.

## Review
- **code-reviewer, should-fix (fixed):** interview question 1 said a cache in `useState` does not leak. Wrong
  mental model: a cache in the state of a component that never unmounts (root, provider) leaks the same way. The
  question and answer now say the leak needs no eviction plus a page-long owner, and the fix is a limit.
- **code-reviewer, nit (fixed):** card text "Each report below holds 1 MB" (no reports are listed below) → "Each
  report holds about 1 MB"; the code comment now says 1 MiB (about 1 MB), matching `docs/PROGRESS.md`.
- **code-reviewer, nit (fixed):** "the production build renames `Report` and the Maps" → it renames the `Report`
  class and the `unboundedCache` variable (built-ins like `Map` keep their name). Here and in `docs/PROGRESS.md`.
- **code-reviewer, nit (fixed):** the `PerformancePage` comment now says leaks are "work or data that outlives its
  component" (this card's leak is data, not a timer or listener).
- **security-reviewer:** no findings.

## Interview questions
1. **Why does a module-level cache leak?** Module variables live as long as the page, so everything they reference
   stays reachable and the garbage collector cannot free it. The leak needs two things: no eviction and an owner that
   lives as long as the page. A cache in the state of a component that never unmounts (the root, a context provider)
   leaks the same way; the fix is a limit, not a different place to store it.
2. **How do you find a leak with heap snapshots?** Take a snapshot, do the suspected action several times, take a
   second one, and compare: objects whose count keeps growing are the suspects. The Retainers panel shows the
   reference chain that keeps one alive (here: a Map in a module scope), which points to the code to fix.
3. **How can a cache be bounded?** A size limit (remove the oldest entry: FIFO; or the least recently used: LRU,
   where a read moves the entry to the end), a time limit (TTL), or a `WeakMap` when the key is an object: the entry
   disappears when nothing else references the key. Libraries like TanStack Query remove unused entries after a
   timeout (`gcTime`).
