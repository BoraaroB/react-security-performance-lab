# PR 25b: Memory leak demo: an event listener without cleanup, `useEventListener`

## What and why
A `window.addEventListener` in `useEffect` without a cleanup stays on `window` after the component unmounts. Window
keeps the handler (and the component's state in its closure) in memory, the handler keeps running on every event,
and every new mount adds one more listener. This PR adds a portable `useEventListener` hook that removes the listener
on unmount, and a demo card with a leaky and a fixed mouse-move tracker. goal.md: P3 (memory leaks). Second of three
leak PRs (25a interval, 25c cache).

## Changes
- `frontend/src/hooks/useEventListener/index.ts`: `useEventListener(type, handler, { capture, passive })` for
  `window`. The event is typed from the name (`keydown` → `KeyboardEvent`). `useEffectEvent` always calls the newest
  handler without re-adding the listener; the same `listener` function goes to add and remove.
- `frontend/src/hooks/useEventListener/README.md`: usage, parameters, why elements use JSX props, the ref pattern
  for React < 19.2.
- `frontend/src/features/performance-demo/ListenerLeakDemo.tsx`: `LeakyTracker` (no cleanup, on purpose) and
  `FixedTracker` (`useEventListener`), a show/hide button, module counters (they survive the unmount) that the card
  reads once a second with `useInterval`.
- `frontend/src/pages/PerformancePage.tsx`: sixth card.

## How to test
```bash
cd frontend
npm run dev    # http://localhost:5173/performance, card "Memory leak: an event listener without cleanup"
```
Move the mouse: both trackers count. Click "Hide trackers" and move the mouse again: "Fixed listener total calls"
stops, the leaky calls keep growing. Show and hide again: "Leaky listeners added" grows and each move adds more
calls. In dev, StrictMode mounts twice, so each mount leaks 2 listeners; `vite build && vite preview` shows 1.

## How to reuse in another project
Copy `src/hooks/useEventListener/` (needs `react@^19.2`, or use the ref pattern from the README).
```tsx
const [lastKey, setLastKey] = useState('');
useEventListener('keydown', (event) => setLastKey(event.key));
useEventListener('scroll', onScroll, { passive: true });
```

## Verification
- `npm run typecheck`, `npx eslint .`, `vite build`: OK. `PerformancePage` chunk 9.41 → 11.34 kB, `vendor-rVIGF7vT.js` unchanged.
- Headless Chrome, a DevTools Protocol script that sends 10 mouse moves per phase and reads the counters:

  | Phase (10 moves each) | Dev server (StrictMode) | `vite preview` (production) |
  |---|---|---|
  | shown | leaky listeners 2, leaky calls 20, fixed 10 | 1, 10, fixed 10 |
  | hidden | leaky calls 40, fixed 10 | 20, fixed 10 |
  | show + hide, then moves | leaky listeners 4, leaky calls 80, fixed 10 | 2, 40, fixed 10 |

  No console errors, no CSP reports in preview.

## Review
- **code-reviewer, should-fix (fixed):** `passive` defaulted to `false` and was always passed, which turned off the
  browser's passive default for `touchstart`/`touchmove`/`wheel` on window (scroll waits for JavaScript). `passive`
  now has no default: `undefined` means "not given", so the browser's default applies. README and question 3 updated.
- **code-reviewer, nit (fixed):** the README said only a new `type` re-adds the listener; it now says `type`,
  `capture` or `passive`.
- **security-reviewer:** no findings.

## Interview questions
1. **Why does a missing `removeEventListener` leak memory?** `window` lives as long as the page, and it holds a
   reference to the handler. The handler's closure holds the component's state setter and values, so none of it can
   be garbage collected, and it keeps running on every event.
2. **What is wrong with `return () => window.removeEventListener('resize', () => onResize())`?** It removes a NEW
   function, not the one that was added, so nothing is removed. Remove needs the same function reference (and the same
   `capture` flag). The same bug happens with `handler.bind(this)` in both calls.
3. **What does `passive: true` do?** It promises the handler never calls `preventDefault()`, so the browser can start
   scrolling at once instead of waiting for JavaScript. Browsers make `touchstart`/`touchmove`/`wheel` on window
   passive by default, so a hook must not pass an explicit `passive: false` when the caller gave none.
