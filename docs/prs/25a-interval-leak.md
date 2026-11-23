# PR 25a: Memory leak demo: an interval without cleanup, `useInterval`

## What and why
A `setInterval` started in `useEffect` without a cleanup keeps running after the component unmounts. It keeps its
callback (and the component's state) in memory, does work nobody sees, and every new mount adds one more interval.
This PR adds a portable `useInterval` hook that clears the interval on unmount, and a demo card that shows a leaky
and a fixed timer side by side. goal.md: P3 (memory leaks). First of three leak PRs (25b listener, 25c cache).

## Changes
- `frontend/src/hooks/useInterval/index.ts`: `useInterval(callback, delayMs | null)`. `useEffectEvent` (React 19.2+)
  always calls the newest callback, so the interval does not restart on every render and never sees stale state.
  `null` pauses; the cleanup calls `clearInterval`.
- `frontend/src/hooks/useInterval/README.md`: usage, parameters, the older ref pattern for React < 19.2.
- `frontend/src/features/performance-demo/IntervalLeakDemo.tsx`: `LeakyTimer` (no cleanup, on purpose) and
  `FixedTimer` (`useInterval`), a show/hide button, and counters in module scope (they survive the unmount) that the
  card reads once a second.
- `frontend/src/pages/PerformancePage.tsx`: fifth card.

## How to test
```bash
cd frontend
npm run dev    # http://localhost:5173/performance, card "Memory leak: an interval without cleanup"
```
Click "Hide timers", wait a few seconds: "Fixed timer total ticks" stops, the leaky ticks keep growing. Show and hide
again: "Leaky intervals started" grows and the leaky ticks grow faster. In dev, StrictMode mounts twice, so each mount
leaks 2 intervals; `vite build && vite preview` shows 1 per mount. Reload to stop them.

## How to reuse in another project
Copy `src/hooks/useInterval/` (needs `react@^19.2`, or use the ref pattern from the README).
```tsx
const [seconds, setSeconds] = useState(0);
const [isPaused, setIsPaused] = useState(false);
useInterval(() => setSeconds(seconds + 1), isPaused ? null : 1000);
```

## Verification
- `npm run typecheck`, `npx eslint .`, `vite build`: OK. `PerformancePage` chunk 7.65 → 9.41 kB, `vendor-rVIGF7vT.js` unchanged.
- Headless Chrome, a DevTools Protocol script that clicks the button and reads the counters:

  | Moment | Dev server (StrictMode) | `vite preview` (production) |
  |---|---|---|
  | shown 3.5 s | leaky intervals 2, leaky ticks 4, fixed 2 | 1, 3, fixed 3 |
  | hidden 3 s | leaky ticks 10, fixed 2 | 6, fixed 3 |
  | show + hide, 3 s more | leaky intervals 4, leaky ticks 24, fixed 2 | 2, 11, fixed 3 |

  No console errors, no CSP reports in preview.

## Review
- **code-reviewer, should-fix (fixed):** the card said each mount makes "it" tick faster, but the visible leaky timer
  is a new component that counts 1 per second; only the total ticks grow faster. The text now says so.
- **code-reviewer, nit (fixed):** the counters started at 0 on every mount of the card, so coming back to the page
  showed 0 for a second (as if the leak was gone). `useState` now starts from the module counters (lazy initializer).
- **code-reviewer, nits (fixed, docs):** interview question 2 now shows the snippet with its cleanup; the "How to
  reuse" snippet declares `isPaused`.
- **security-reviewer:** no findings.

## Interview questions
1. **Why does a missing `clearInterval` leak memory?** The browser's timer list holds the callback, the callback's
   closure holds the component's state setter and values, so none of it can be garbage collected, and it keeps running.
2. **What is wrong with `useEffect(() => { const id = setInterval(() => setCount(count + 1), 1000); return () => clearInterval(id); }, [])`?** Stale closure:
   the callback sees `count` from the first render, so the count sticks at 1. Adding `count` to the deps restarts
   the interval every tick. `useEffectEvent` (or a ref) gives the newest callback without restarting.
3. **Why does StrictMode mount components twice in development?** To run mount → cleanup → mount, so effects with a
   missing or wrong cleanup show their bug (here: two intervals) early. Production mounts once.
