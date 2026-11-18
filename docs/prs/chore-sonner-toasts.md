# Chore: replace the custom toasts with sonner

## What and why
Step 17c built a toast system by hand to learn how it works inside: a live region, timer cleanup, a stable context
value. In the app itself, a well-tested library is the better choice: `sonner` already does what 17c listed as known
gaps (pause on hover, pause while the tab is hidden, a keyboard shortcut `alt+T` to reach the toasts, swipe on
mobile, promise toasts). Checked in its source: a polite live region, a close button with `aria-label="Close toast"`,
icons `aria-hidden`. Focusing a toast with Tab does not pause its timer (noted in `docs/PROGRESS.md`). The custom module stays in the repo as reference
code in `src/examples/custom-toast/` (not imported, not bundled) and is explained in `docs/prs/17c-toasts.md`. Topic: DX; also a common interview question ("when do you build, when do you use a library?").

## Changes
- `frontend/src/components/feedback/Toast/` → `frontend/src/examples/custom-toast/`: kept as **reference only** (the
  user's request), README and `index.ts` say so; nothing imports it, so it is not in the bundle, but typecheck and
  lint still check it.
- `CLAUDE.md`: `src/examples/` added to the structure, `Toast` removed from `feedback/`, `sonner 2` in the stack table.
- `frontend/package.json` + lock file: `sonner@^2.0.8` (MIT, no dependencies, React 18/19; installed with `--before`).
- `frontend/src/main.tsx`: `<Toaster richColors closeButton />` next to `RouterProvider` instead of `<ToastProvider>`.
- `frontend/src/pages/ComponentsPage.tsx`: the demo buttons call `toast.info` / `toast.success` / `toast.error` (the error with a fixed `id`).

## How to test
```bash
cd frontend && npm install && npm run dev
```
Open http://localhost:5173/components. "Info toast" and "Success toast" close after 4 seconds (the timer pauses
while the mouse is over them); "Error toast" stays until you click ×; clicking it again does not add a second one (same `id`). `alt+T` moves
focus to the toasts.

## How to reuse in another project
```bash
npm install sonner
```
```tsx
<Toaster richColors closeButton />                                   // once, next to the app
toast.success('Post deleted');                                      // anywhere
toast.error('Could not save the post', { id: 'SAVE_FAILED', duration: Infinity }); // stays; same id = no pile-up
```

## Verification
- `npm run typecheck`, `npx eslint .`, `vite build`: pass. Main file 350 → 384 kB (gzip +9 kB): the cost of the library.
- `grep "Dismiss notification" dist/assets/*.js`: 0 hits, so `src/examples/custom-toast/` is not in the bundle.
- Headless Chrome (dev server, CDP script): 10 clicks on "Error toast" leave 1 toast in the DOM (same `id`);
  `<section aria-live="polite" aria-label="Notifications alt+T">` exists
  before any toast; info gone after 5 s, error stays; the close button removes it; no console warnings; sonner's
  `<style>` tag is in the page (see the CSP note in `docs/PROGRESS.md` known gaps).

## Review
- code-reviewer (should-fix): the docs said timers pause on focus; in sonner's source, Tab focus does not pause them
  (only hover, pressing, `alt+T`, hidden tab). **Fixed** the text here and in `docs/PROGRESS.md`.
- code-reviewer (should-fix): `duration: Infinity` errors could pile up without limit (sonner never drops an active
  toast; 17c had `maxToasts`). **Fixed:** the convention is now `{ id: <error code>, duration: Infinity }` (same id
  updates the toast); the demo uses a fixed `id`.
- code-reviewer (should-fix): `CLAUDE.md` still lists `Toast` under `components/feedback/` and has no `sonner` in the
  stack table. **Fixed after the user agreed** (CLAUDE.md holds the project instructions, so it is changed only on request).
- code-reviewer (nit): an old known-gap line still pointed to "toasts in 17c". **Fixed** ("toasts with sonner").
- code-reviewer (nit): the CSP note missed a third option (bundle `sonner/dist/styles.css`). **Fixed** (note + interview answer).
- code-reviewer (nit): "tested with real screen readers" had no source. **Fixed:** replaced with what was checked in the source.
- security-reviewer: no findings.

## Interview questions
1. **When do you write your own component, and when do you use a library?** Own: small, core to the product, or
   when you need to learn/control it. Library: a solved problem with many edge cases (accessibility, animations,
   mobile), well maintained, small, few dependencies. Check license, size, maintenance, and how it fits your CSP.
2. **What do you check before adding an npm package?** Weekly use and last release, open issues, license,
   dependencies (fewer = smaller supply-chain risk), bundle size, peer versions, and pin or delay installs (`--before`).
3. **Why does this library matter for CSP?** Sonner injects a `<style>` tag at runtime; `style-src 'self'` blocks it.
   Options: a hash for that CSS, `'unsafe-inline'` for styles, or bundle `sonner/dist/styles.css` and keep the strict CSP.
