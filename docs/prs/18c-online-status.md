# PR 18c: Online status hook and offline banner

## What and why
When the laptop loses Wi-Fi, every request fails with a generic "could not be reached" error and the user does not
know why. A new portable hook, `useOnlineStatus`, reads the browser's online state, and the layout shows a banner
while the browser is offline. The hook uses `useSyncExternalStore`, React's built-in way to read a value that lives
outside React (here `navigator.onLine` + the `online`/`offline` events). It gets the right value on the first
render and removes its listeners on unmount (goal.md: memory leaks). It also eases the 18b gap "retries while
offline": requests still retry, but the banner now tells the user why.

## Changes
- `frontend/src/hooks/useOnlineStatus/index.ts` (new): `subscribe` (adds and removes the two window listeners),
  `getSnapshot` (`navigator.onLine`), `getServerSnapshot` (`true`), and the hook that passes them to `useSyncExternalStore`.
- `frontend/src/hooks/useOnlineStatus/README.md` (new): usage, what `true`/`false` really mean, how to reuse.
- `frontend/src/layouts/RootLayout.tsx`: an amber banner under the nav, inside the sticky header (stays visible
  while scrolling). Its `role="status"` wrapper is always mounted, so screen readers announce the message.

## How to test
```bash
cd frontend && npm run dev     # open http://localhost:5173
```
- Chrome DevTools → Network → throttling → "Offline" → the banner appears at once (no reload).
- Back to "No throttling" → the banner disappears.
- With the banner on, open `/components` → "Health check": the request still fails (retries, then the error toast),
  but now the banner explains why.
- Scroll down while offline: the banner stays at the top with the header.

## How to reuse in another project
Copy `src/hooks/useOnlineStatus/` (only React 18+ needed):
```tsx
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

const isOnline = useOnlineStatus();
return <div role="status">{!isOnline && <p>You are offline.</p>}</div>;
```

## Verification
- `npm run typecheck`, `npm run lint`, `vite build`: pass (main file 384 kB, `ComponentsPage` chunk 8.4 kB).
- Portability grep on `src/hooks`: no imports outside the folder, no env access.
- Server render (`renderToString`, bundled with esbuild, run in Node): the hook returns `true` (server snapshot), no crash.
- Dev server: `/` → 200, `RootLayout.tsx` and the hook module are served and transformed.
- The offline/online switch itself was not automated (no browser in this session): check it with the DevTools steps above.

## Review
- security-reviewer: no findings.
- code-reviewer [should-fix]: the banner said "Pages and data will load again when the connection is back", but
  nothing reloads on its own (see the 18c → 19 known gap). **Fixed:** "Some features may not work until the
  connection is back."
- code-reviewer [should-fix]: this description said the 18b gap "retries while offline" is closed; GETs still retry
  offline, the banner only explains it. **Fixed** the wording ("eases"), now the same as `PROGRESS.md`.
- code-reviewer [nit]: the README said the listeners are removed "when the last component using it unmounts". React
  calls `subscribe` once per component, so each component adds and removes its own pair. **Fixed** the README.

## Interview questions
1. **Why `useSyncExternalStore` and not `useState` + `useEffect`?** With an effect, the first render uses a guessed
   value and the real one arrives one render later (a flash), and an event that fires between the render and the
   effect is lost. `useSyncExternalStore` reads the value during the render and re-renders on every change, and in
   concurrent rendering all components see the same value in one render (no "tearing").
2. **Why are `subscribe` and `getSnapshot` defined outside the hook?** React compares `subscribe` by reference;
   a new function on every render makes it unsubscribe and subscribe again each time. `getSnapshot` must return the
   same value while nothing changed (a primitive like a boolean is safe; a new object each call loops forever).
3. **Can you trust `navigator.onLine === true`?** No. `false` reliably means no network. `true` only means "connected
   to some network": a captive-portal Wi-Fi or a down server still fails. So the banner is a hint, and the http
   client must still handle `NetworkError`.
