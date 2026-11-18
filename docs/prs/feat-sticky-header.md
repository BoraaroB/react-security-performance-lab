# Feat: sticky, see-through header

## What and why
The header (navigation) scrolled away with the page. Now it stays at the top like on most modern sites, and it is
see-through with a blur, so the page is visible scrolling under it. A sticky header can hide the element that has
keyboard focus, so the page also keeps space free at the top when the browser scrolls to a focused element
(WCAG 2.4.11 Focus Not Obscured). No JavaScript: CSS only.

## Changes
- `frontend/src/layouts/RootLayout.tsx`: header gets `sticky top-0 z-10`, `bg-white/70` + `backdrop-blur-md`
  (only where `backdrop-filter` is supported; otherwise `bg-white/95`, so the links stay readable).
- `frontend/src/index.css`: `html { scroll-padding-top: 4rem }` (a bit more than the 45 px header).

## How to test
```bash
cd frontend && npm run dev
```
Open http://localhost:5173/components in a small window and scroll: the header stays at the top and the buttons
and cards are blurred under it. Scroll to the bottom and press Shift+Tab until a form field gets focus: it is never
hidden under the header.

## How to reuse in another project
```tsx
<header className="sticky top-0 z-10 bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/70">…</header>
```
```css
html { scroll-padding-top: 4rem; } /* a bit more than the header's height */
```

## Verification
- `npm run typecheck`, `npx eslint .`, `vite build`: pass.
- Headless Chrome, 390×500 window, `/components` (page 1177 px tall): after `scrollTo(0, 400)` the header's top is
  0; computed style `backdrop-filter: blur(12px)`, background white at 0.7 alpha; `scrollIntoView({ block: 'start' })`
  on the email field puts it at 64 px (4rem), below the header's bottom (45 px). A screenshot shows the blurred
  buttons under the header.
- Real keyboard path (390×300 window): from the last button at the bottom, 9× Shift+Tab (CDP key events) up to the
  first button: no focused element was under the header; elements the browser had to scroll up to landed at 64 px.

## Review
- code-reviewer (nit): Safari 16.4–17.x have only `-webkit-backdrop-filter`, so `@supports (backdrop-filter: …)` is
  false there: they get the 95% background, but still blurred (Tailwind writes the `-webkit-` property too). Nothing
  breaks. **Fixed** the wording in `docs/PROGRESS.md` (no extra `@supports` check, as the reviewer advised).
- code-reviewer (nit): the focus claim was only tested with `scrollIntoView({ block: 'start' })`, not with the
  keyboard. **Fixed:** tested real Shift+Tab in headless Chrome (see Verification); not tested in Firefox or Safari.
- security-reviewer: no findings (no framing change, no inline styles, so a strict `style-src` is not affected).

## Interview questions
1. **`sticky` or `fixed`?** `fixed` takes the header out of the page flow, so the content needs a top padding equal
   to the header height (and breaks if the height changes). `sticky` stays in the flow and only sticks once you
   scroll. It stops working if an ancestor has `overflow: hidden/auto`.
2. **What accessibility problem does a sticky header create?** It can cover the focused element or a `#anchor`
   target (WCAG 2.4.11). `scroll-padding-top` on `html` makes the browser leave that space free.
3. **Is `backdrop-filter` expensive?** The blur is recomputed while the page scrolls under it, which costs GPU
   time; fine for one small header, but avoid it on large or many elements (P1/P2 performance).
