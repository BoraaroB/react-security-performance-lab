# PR 19: useFetch hook and ErrorState

## What and why
Pages need to load data when they open. The naive way (`fetch` in a `useEffect`, then `setState`) has two bugs:
the request keeps running after the component unmounts (a leak), and when the path changes fast, a slow old answer
can arrive last and overwrite the new data (a race). `useFetch` fixes both with an `AbortController` that the effect
cleanup aborts (goal.md: memory leaks, P3). `ErrorState` shows a failed load with a safe text chosen by the error
type, the server's request ID, and a "Try again" button that calls `reload()`.

## Changes
- `frontend/src/hooks/useFetch/index.ts` (new): `useFetch<T>(http, path)` → `{ data, error, isLoading, reload }`.
  Each request has a `requestNumber` (+1 on `reload()` and on every path change, set during render with React's
  "previous props" pattern); only the answer to the current number is shown, so `isLoading` is derived instead of
  set inside the effect (the `react-hooks` lint rule `set-state-in-effect`).
- `frontend/src/hooks/useFetch/README.md` (new): usage, return value, StrictMode note, no cache.
- `frontend/src/components/feedback/ErrorState/` (new): `ErrorState({ error, onRetry, title? })` on top of `Alert` +
  `Button`; never shows `error.message`. README + `index.ts`.
- `frontend/src/pages/ComponentsPage.tsx`: a `HealthWidget` demo card that switches between `/api/health` and a 404 path.

## How to test
```bash
npm run dev:express     # open http://localhost:5173/components
```
- The "useFetch" card shows a spinner, then "API status: ok, up for N s".
- DevTools → Network: in dev you see one `health` request "(canceled)" and one 200. That is StrictMode running the
  effect twice; the first request is aborted by the cleanup.
- "Load a missing route (404)" → `ErrorState` with "Error code: NOT_FOUND · Request ID: …". "Try again" sends it again.
- Click the two buttons quickly with Network throttling "Slow 4G": old requests show "(canceled)", the card always
  shows the answer for the last button.
- Stop the API → "Try again" → after the retries: "The server could not be reached".

## How to reuse in another project
Copy `src/hooks/useFetch/`, `src/components/feedback/ErrorState/`, `src/components/ui/`, `src/lib/cn/`, `src/lib/http/`.
```tsx
const { data, error, isLoading, reload } = useFetch<Post[]>(http, '/api/posts');
if (isLoading) return <Spinner />;
if (error) return <ErrorState error={error} onRetry={reload} />;
return <PostList posts={data ?? []} />;
```

## Verification
- `npm run typecheck`, `npx eslint src`, `vite build`: pass (main file 384 kB, `ComponentsPage` chunk 10.4 kB).
- Portability grep on `src/hooks` and `src/components`: only `@/lib/http`, `@/components/ui` (listed in the READMEs).
- Express API: `GET /api/health` → 200 with `Access-Control-Allow-Origin: http://localhost:5173`;
  `GET /api/does-not-exist` → 404 `NOT_FOUND` with a `requestId`. Dev server serves and transforms both new modules.
- The card itself was not clicked through (no browser in this session): check it with the steps above.

## Review
- security-reviewer: no findings.
- code-reviewer [should-fix]: the first version keyed requests by `${reloadCount}:${path}`. Going A → B → A quickly
  gave the old key again, so the OLD answer for A showed as current (not loading) while a new request for A was
  running. **Fixed:** a `requestNumber` that also goes up on every path change (`prevPath` state, updated during render).
- code-reviewer [nit]: the README did not say that `http` must be stable (it is an effect dependency; a client created
  inside the component would refetch forever). **Fixed:** a line in the README notes.
- code-reviewer [nit]: `ErrorState` imports `components/ui`, which is not a `lib` module (portable-module rule 2), and
  its README listed it under `lib:`. **Fixed:** own `components:` line in the README; the exception is recorded in
  `PROGRESS.md` (reusing `Alert` keeps the error role and colors in one place).

## Interview questions
1. **Why abort the request in the effect cleanup?** The cleanup runs on unmount and before the effect runs again.
   Aborting stops the network work and the retry wait, and the `signal.aborted` check stops a late `setState`, so a
   slow answer for an old path can never overwrite newer data (a race condition).
2. **Why does React 18/19 StrictMode show a cancelled request in dev?** StrictMode mounts, unmounts, and mounts
   again to find effects without cleanup. With the abort, the first request is cancelled; without it, both would
   finish and both would call `setState`.
3. **Why not show `error.message` to the user?** It can reveal internals (stack hints, SQL, hostnames) and its wording
   can change. The UI picks a text by error type or `code`, and shows the request ID so support can find the log line.
