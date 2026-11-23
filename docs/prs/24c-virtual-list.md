# PR 24c: VirtualList

## What and why
A plain list of 10,000 rows creates 10,000 DOM elements: a slow first render, a lot of memory, and slow layout and
scrolling. Virtualization (also called "windowing") renders only the rows you can see plus a few extra, and moves
them while you scroll; an inner box as tall as all rows keeps the scrollbar right. This PR adds a portable, hand-written
`VirtualList` (no library, so every line can be followed) and a third card on `/performance` to compare it with a
plain list. goal.md: P1 (React rendering). Third of the four step-24 PRs. No new dependencies.

## Changes
- `frontend/src/components/ui/VirtualList/core.ts`: `getVisibleRange()`, the framework-free math
  (first visible row − overscan … first visible row + rows that fit + 1 + overscan, clamped to the list).
- `frontend/src/components/ui/VirtualList/VirtualList.tsx`: the component. State is the first visible ROW (not
  `scrollTop` in px), so scrolling inside one row does not re-render. Rows are absolutely positioned (`top = index ×
  rowHeight`) inside a box of `items.length × rowHeight`. `role="list"` + `aria-posinset`/`aria-setsize` ("row 5,001
  of 10,000" for screen readers), `tabIndex={0}` for keyboard scrolling, required `getKey` (stable keys, not indexes).
- `frontend/src/components/ui/VirtualList/index.ts`, `README.md`; `frontend/src/components/ui/index.ts` exports it.
- `frontend/src/features/performance-demo/VirtualListDemo.tsx`: 10,000 rows, checkbox "Render only the visible rows".
- `frontend/src/pages/PerformancePage.tsx`: adds the card.

## How to test
`cd frontend && npm run dev`, open http://localhost:5173/performance, card "Virtual list":
1. DevTools → Elements: the list has ~20 children; scroll, and the row texts change, the count does not.
2. Uncheck the checkbox: the `<ul>` has 10,000 `<li>`. DevTools → Performance with 4× CPU slowdown shows the cost.

## How to reuse in another project
Copy `src/components/ui/VirtualList/` and `src/lib/cn/` (needs `react@^19`, `tailwindcss@^4`, the `@/` alias).
```tsx
<VirtualList
  items={users}
  rowHeight={32}
  height={320}
  getKey={(user) => user.id}
  renderRow={(user) => <span className="px-3">{user.name}</span>}
  label="Users"
/>
```
For rows of different heights, window scrolling, or grids, use `@tanstack/react-virtual` (it measures rows).

## Verification
- `npm run typecheck`, `npx eslint src`, `vite build`: OK. `VirtualList` is only in the `PerformancePage` chunk
  (6.1 kB, was 4.0 kB), not in the entry chunk. Portability grep: no imports leave the module except `@/lib/cn`.
- Headless Chrome (CDP) on `vite preview` (production build, with the CSP headers):

  | Check | Result |
  |---|---|
  | Rows in the DOM (top / middle / bottom) | 16 / 21 / 16 of 10,000; inner box 320,000 px |
  | Scroll to row 5,000 | renders Row 4996 … Row 5016, `aria-posinset` 5001 / `aria-setsize` 10000 |
  | DOM elements on the page | 372 (virtual) vs 10,339 (plain) |
  | Switch to plain / back to virtual | 46–61 ms / 5–14 ms; at 4× CPU slowdown 141–184 ms / 21–22 ms |
  | CSP `style-src` violations | none (React sets `style` via CSSOM, which `style-src 'self'` allows) |

  Preview ran on port 5180 (5173 was busy) with a test build, so the only CSP reports were `connect-src` for the
  API's CSRF call (test setup, not this PR).

## Review
- **code-reviewer, should-fix (documented):** the stored first row is computed with the `rowHeight` at scroll time;
  if `rowHeight` changes with no scroll, rows render in the wrong place. Fix: the prop comment and README say it must
  not change while mounted (remount with `key={rowHeight}`). Storing px or reading a ref in render would undo the
  "state = row" idea.
- **code-reviewer, should-fix (fixed):** `components/ui/README.md` said every component takes HTML props and did not
  mention `VirtualList`. It now links to `VirtualList/README.md`, which says it takes only its own props.
- **code-reviewer, nit (fixed):** when `items` shrinks while scrolled far down, the stored row could be past the end
  (one render with zero rows). `getVisibleRange` now clamps it to the last full screen of rows.
- **code-reviewer, nit (fixed):** the focusable scroll box had no name; `label` moved to it (`role="group"` +
  `aria-label`), so a screen reader announces it on Tab.
- **code-reviewer, nit (fixed):** interview answer 3 now says React "bails out" (it may call the component once
  more but skips the children) instead of "always skips".
- code-reviewer confirmed the range math (top 0–15, bottom ends at Row 10000, Safari negative `scrollTop` clamped)
  and the ARIA structure. **security-reviewer:** no findings.

## Interview questions
1. **What is list virtualization and when do you need it?** Rendering only the visible rows of a long list. Use it
   when a list has thousands of rows (or heavy rows) and the first render, memory, or scrolling is slow. For ~100
   simple rows it is extra complexity for nothing; pagination or "load more" is often simpler.
2. **What are the downsides?** Browser find (Ctrl+F) does not see rows that are not rendered; screen readers need
   `aria-setsize`/`aria-posinset`; rows of unknown height must be measured; fast scrolling can show blank space for
   a frame (overscan reduces it); row state (an open menu, input text) is lost when a row scrolls out.
3. **Why is the state the first visible row and not `scrollTop`?** `scroll` fires many times per row. Rounding to a row
   means most events set the same number. When the new state is `Object.is`-equal to the old one, React bails out:
   at most it calls the component once more and skips its children, usually it does not render at all.
