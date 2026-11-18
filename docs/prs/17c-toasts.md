# PR 17c: Toast notifications

## What and why
Some feedback does not belong on the page itself: "Post deleted" after a click, or "Could not save" after a request
fails (error boundaries do not catch event-handler or async errors). Toasts show it in a corner. The PR covers three
topics: accessibility (a polite live region), memory leaks (every auto-dismiss timer is cleared in the effect's
cleanup), and render cost (the context holds only `showToast`, so components that show toasts do not re-render when
the list changes).

## Changes
- `frontend/src/components/feedback/Toast/ToastProvider.tsx`: list state, `showToast` / `dismiss` (stable with `useCallback`), the live region, `useToast()`.
- `frontend/src/components/feedback/Toast/ToastItem.tsx`: one toast; `setTimeout` in `useEffect` with `clearTimeout` cleanup; message as text; × button.
- `frontend/src/components/feedback/Toast/index.ts` + `README.md`: public API and usage.
- `frontend/src/main.tsx`: `<ToastProvider>` around `RouterProvider`.
- `frontend/src/pages/ComponentsPage.tsx`: demo card with info / success / error buttons.

## How to test
```bash
cd frontend && npm run dev
```
Open http://localhost:5173/components. "Info toast" and "Success toast" disappear after 5 seconds; "Error toast"
stays until you click ×. Click more than 3 times: only the newest 3 stay. With VoiceOver on, each new toast is read once.

## How to reuse in another project
Copy `src/components/feedback/Toast/` (needs `react@19` and Tailwind for the classes).
```tsx
<ToastProvider>
  <App />
</ToastProvider>

const showToast = useToast();
showToast({ message: 'Post deleted', variant: 'success' });
```

## Verification
- `npm run typecheck`, `npx eslint .`, `vite build`: pass. Main file 349 → 350 kB.
- Headless Chrome (dev server, CDP script): the live region exists before any toast and has no `role`; info gone after
  5 s, error stays; after 3 more clicks there are exactly 3 toasts (the oldest, the error, was dropped); × closes one;
  after 5 more seconds all are gone; no console warnings.

## Review
- security-reviewer (low) + code-reviewer (nit), same finding: `.slice(-maxToasts)` with `maxToasts={0}` is
  `slice(0)` and keeps every toast, so the limit is off. **Fixed:** `.slice(-Math.max(1, maxToasts))`; README says
  values below 1 count as 1.
- code-reviewer (nit): `setTimeout` treats delays above 2^31−1 ms (and `Infinity`) as 0, so a huge `durationMs`
  closes toasts at once. **Fixed** in the README (no code: there is no "never" for info/success on purpose).
- code-reviewer (nit): the × button had no `focus-visible` ring and `opacity-70` faded the default one. **Fixed:**
  same `focus-visible` classes as `Button`, plus `focus-visible:opacity-100`.
- code-reviewer (nit): closing a toast with the keyboard removes the focused button, so focus goes to `<body>`.
  **Postponed:** added to "Toast limits (17c)" in the known gaps.

## Interview questions
1. **Why must the live region exist before the toast is added?** Screen readers watch live regions that are already
   in the page; a new element that arrives together with its `aria-live` is often not announced.
2. **Why `aria-live="polite"` and not `role="status"` or `role="alert"`?** `alert` interrupts the user (assertive).
   `status` implies `aria-atomic="true"`, so every visible toast would be read again when one is added.
3. **Where can a toast timer leak, and how is it prevented?** A `setTimeout` without cleanup keeps running after the
   toast or the whole app is gone. The `useEffect` returns `clearTimeout`, and `onDismiss` is a stable function so
   the effect does not restart the timer on every render.
