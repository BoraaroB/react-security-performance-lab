# Feat: responsive header and page padding

## What and why
On a phone the header showed every link in one row, so it ran off the screen (an admin has six links, a name, and
"Log out"). Now the links fold into a "Menu" button below 768 px (`md`), and the page padding is 16 px on phones
instead of 32 px. The pages themselves already worked on small screens (one column, long text wraps, the admin table
scrolls sideways), so they are unchanged. The one new concept: a disclosure menu (`aria-expanded`), built with CSS
breakpoints, not a second copy of the links.

## Changes
- `frontend/src/layouts/RootLayout.tsx`:
  - "Menu" button (`md:hidden`) with `aria-expanded` + `aria-controls="main-menu"`.
  - One link list for every size: a column on phones (`hidden` while closed), a row from `md` up.
  - A link click closes the menu. Escape closes it and moves focus back to the button (`useEventListener` from 25b).
  - Taller links on phones (`py-2`), the user's name cut off with `…` (`truncate max-w-48`, full name in `title`).
  - The header is `max-w-4xl` (an admin's row needs ~650 px, `max-w-2xl` has 608).
  - `<main>` and the offline banner use `px-4 sm:px-8`.
- `frontend/src/router/routes.tsx`: same padding for the layout's error page.
- `docs/`: step 25c marked as merged (PR #67) in `IMPLEMENTATION_PLAN.md` and `PROGRESS.md`.

## How to test
```bash
cd frontend && npm run dev
```
Open http://localhost:5173 and DevTools → device toolbar (iPhone, 375 px):
1. Only "Menu" shows. Click it: the links show as a list. Click "Security": the page opens and the menu closes.
2. Open the menu, Tab to a link, press Escape: the menu closes and the focus ring is on "Menu".
3. Make the window ≥ 768 px: the button disappears and the links are in one row. Log in as `admin@example.com`:
   everything still fits in one row.

## How to reuse in another project
```tsx
const [open, setOpen] = useState(false);
<button aria-expanded={open} aria-controls="menu" onClick={() => setOpen(!open)} className="md:hidden">Menu</button>
<div id="menu" className={cn('flex-col md:flex md:flex-row', open ? 'flex' : 'hidden')}>{links}</div>
```

## Verification
- `npm run typecheck`, `npx eslint .`, `vite build`: pass.
- Headless Chrome (DevTools protocol script, against the dev server, no backend running):
  - 375 px: `/`, `/components`, `/security`, `/performance`, `/login`, `/register`, a 404 page have 0 px of
    horizontal overflow.
  - Menu closed → `aria-expanded="false"`, list `display: none`. Open → `"true"`, `flex`, links 36 px tall.
  - Tab to "Home", then Escape → closed, focus on "Menu". Click "Security" in the menu → `/security`, menu closed.
  - `/login`, menu open, focus in the email field, Escape → menu closed, focus stays in the email field.
  - 768 px and 1024 px: the button is hidden. The worst-case admin row was faked (Dashboard, Admin, a 100-character
    name, "Log out" added to the DOM, because the API was not running) and fits with no overflow (704/704, 832/832 px):
    the name is cut off with "…", "Log out" stays on one line. Without `min-w-0` on the user box it overflowed (727/704 px).
- Not tested on a real phone, in Safari, or in Firefox.

## Review
- code-reviewer (should-fix): an admin with a long name (up to 100 characters) still overflowed the row between
  768 and ~830 px, because the user box could not shrink below the name's 12rem. **Fixed:** `min-w-0` on the user box.
  While testing that, "Log out" wrapped into two lines (the button shrank too): **fixed** with `shrink-0` on the button.
- code-reviewer (nit): Escape pulled focus to "Menu" even when the user was typing in a page form. **Fixed:** focus
  moves only when it is inside the menu (`menuRef.contains(document.activeElement)`); the menu still closes.
- code-reviewer (nit): the comment said the next Tab "would start from the top of the page"; browsers often keep
  the position. **Fixed:** now says focus falls back to `<body>` and keyboard / screen-reader users lose their place.
- code-reviewer (nit): "Changes" did not mention the 25c bookkeeping in `docs/`. **Fixed** (one bullet).
- security-reviewer: no findings (the SVG uses attributes, not inline styles, so the step 23d CSP is not affected;
  the name is escaped JSX text; the listener is removed on unmount; hiding links is only CSS, access stays on the server).

## Interview questions
1. **Why `aria-expanded` on the menu button?** A screen reader hears "Menu, button, collapsed/expanded", so a blind
   user knows the button opens something and whether it is open. The label stays "Menu"; the state lives in the attribute.
2. **Why hide closed links with `display: none` (`hidden`) and not just move them off screen?** `display: none`
   removes them from the Tab order and the accessibility tree. Off-screen links would still get keyboard focus,
   invisible to the user.
3. **Mobile-first in Tailwind?** Classes without a prefix apply to every width; `md:` overrides from 768 px up. So
   the phone layout is the base, and the bigger screens are the exceptions.
