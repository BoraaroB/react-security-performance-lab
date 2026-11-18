# PR 15a: Reusable UI components (Button, Spinner, Badge, Card, Alert)

## What and why
The first reusable components, styled with Tailwind 4. Each one takes the normal HTML props of its element and a
`className` that overrides the defaults (through `cn` from step 14), so pages never copy long class strings.
They also carry a few safe defaults: a `Button` is `type="button"` (no accidental form submit) and is disabled while
`isLoading` (fewer accidental double POSTs), an error `Alert` uses `role="alert"` so screen readers announce it at once,
and no component accepts `dangerouslySetInnerHTML` (raw HTML does not compile).
React 19: `ref` is a normal prop, no `forwardRef`. Step 15 was split (user's choice): form fields come in 15b.

## Changes
- `frontend/src/components/ui/Button.tsx`: variants `primary | secondary | danger | ghost`, sizes `sm | md`, `isLoading`.
- `Spinner.tsx`: CSS-only spinner with `role="status"` and a screen-reader label.
- `Badge.tsx`: small label, variants `neutral | info | success | warning | error`.
- `Card.tsx`: bordered white box.
- `Alert.tsx`: message box with optional `title`; `role="alert"` for errors, `role="status"` otherwise.
- `types.ts`: `HtmlProps<'div'>` = the element's props without `dangerouslySetInnerHTML` (used by all five).
- `index.ts` (public API) and `README.md`.
- `frontend/src/App.tsx`: a temporary showcase of all five (replaced by pages in step 16).

## How to test
```bash
cd frontend && npm install && npm run dev
```
Open http://localhost:5173: a blue and a red button, a loading one (spinner, not clickable), an "admin" badge, a
spinner, and a red error alert. Press Tab: buttons get a blue focus ring.

## How to reuse in another project
Copy `src/components/ui/` and `src/lib/cn/`, `npm install clsx tailwind-merge`, and add the `@/` alias:
```tsx
import { Button, Alert } from '@/components/ui';
<Button type="submit" isLoading={isSubmitting}>Log in</Button>
{error && <Alert variant="error" title="Login failed">{error}</Alert>}
```

## Verification
- `npm run typecheck`, `npm run lint`, `npm run build`: no errors (CSS 12.8 kB, JS 254 kB).
- Temporary files (deleted): `<Button ref={useRef<HTMLButtonElement>(null)}>` and `<Card ref={...}>` compile; a ref of
  the wrong element type (`HTMLInputElement` on `Button`) does not; `dangerouslySetInnerHTML` on Card, Badge and
  Button and `children` on Spinner do not compile (`@ts-expect-error` checks).
- Size: ~175 changed lines of code (components ≈ 150 incl. `types.ts`, showcase ≈ 25), a bit over the budget.
- `npm run dev` → 200; `@/components/ui` resolves. Portability grep: no hits.

## Review
- **security (low), fixed:** every props type was the full `ComponentProps`, so `dangerouslySetInnerHTML` was accepted
  and spread onto the element (a later page could pass server HTML → stored XSS). New `HtmlProps` in `types.ts` omits it.
- **security (low), fixed:** the Button comment claimed "a double click cannot send the same POST twice". It only helps
  when `isLoading` is set before the first `await`; reworded in code, README and the interview answer.
- **code (should-fix), fixed:** the Spinner inside a loading Button became part of the button's name ("Loading Saving").
  Button now renders `<Spinner aria-hidden="true" />`; `disabled` + `aria-busy` describe the state.
- **code (should-fix), fixed:** the interview answer said refresh-token rotation "rejects a second use" safely; it
  revokes the whole session, and duplicate posts are not deduplicated. Rewritten.
- **code (nit), fixed:** README: color the Spinner with `text-*` (a `border-*` class removes `border-r-transparent`).
- **code (nit), fixed:** Alert comment and README: `role="status"` is read when its text changes while mounted.
- **code (nit), fixed:** the showcase was cut from ~41 to ~25 lines.
- **code (nit), fixed:** `SpinnerProps` no longer accepts `children` (they were silently dropped).

## Interview questions
1. **Why default a button to `type="button"`?** Inside a `<form>`, a `<button>` without a type is a submit button.
   A "Cancel" or "Show password" button would submit the form.
2. **How do you stop a double submit?** Disable the button while the request runs (`isLoading`, set before the first
   `await`). That only stops honest double clicks; the server must handle duplicates itself (idempotency keys or
   unique constraints). Here a second `POST /api/posts` creates a second post, and a reused refresh token revokes
   the whole session.
3. **What changed with refs in React 19?** Function components receive `ref` as a normal prop; `forwardRef` is no
   longer needed (and will be deprecated).
