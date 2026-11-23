# PR 23a: XSS demo and `lib/sanitize` (DOMPurify)

## What and why
A new public page, `/security`, shows the three ways to put user input on a page: as text (React escapes it), as
HTML cleaned by DOMPurify, and as raw HTML (the XSS hole). The raw version runs in a sandboxed iframe, so the
payloads really run (an `alert` shows) but cannot touch the app. `lib/sanitize` is the portable wrapper with secure
defaults (goal.md: S1 XSS). It is the first of four step-23 PRs: 23b dangerous URLs, 23c CSRF + rate limit, 23d CSP.

## Changes
- `frontend/src/lib/sanitize/`: `sanitizeHtml(dirty, options?)` with DOMPurify: HTML profile only (no SVG/MathML),
  always removes `<style>`, `style`, `class`, `data-*` (fake overlays with the app's own CSS) and form controls
  (`form`, `input`, `button`, `select`, `textarea`: phishing); extra tags/attributes can be added but the defaults
  cannot be turned off; throws without a DOM (DOMPurify would return the input **unchanged**). README.
- `frontend/src/features/security-demo/XssDemo.tsx`: payload buttons, a textarea, and the three outputs (the raw
  one resets when the input changes and reloads on every click).
- `frontend/src/pages/SecurityPage.tsx` + router (`PATHS.security`, lazy page, route, "Security" nav link).
- `frontend/package.json`: **new dependency `dompurify@^3`** (in the plan for this step; installed with `--before`).

## How to test
`npm run dev` in `frontend/` (no API needed), open http://localhost:5173/security.
1. "img onerror": box 1 shows the tags as text, box 2 shows `<img src="x">` (handler gone), nothing pops up.
2. "Render without sanitizing": an alert "XSS: img onerror". Do the same for "svg onload" and "javascript: link" (click the link).
3. "CSS overlay": box 2 is a plain paragraph; the raw version covers the whole iframe in red (a fake "log in again" box).

## How to reuse in another project
Copy `frontend/src/lib/sanitize/` and `npm install dompurify`.
```tsx
import { sanitizeHtml } from '@/lib/sanitize';

<div dangerouslySetInnerHTML={{ __html: sanitizeHtml(comment.html) }} />
sanitizeHtml(html, { forbidTags: ['img'] }); // stricter: no images
```

## Verification
- `npm run typecheck`, `npm run lint`, `vite build`: OK. DOMPurify is only in the lazy `SecurityPage` chunk (33 kB, 12.8 kB gzip); the main chunk is unchanged.
- Headless Chrome, `/security` on the dev server: box 1 escaped, box 2 = `<img src="x">`.
- Headless Chrome, the same DOMPurify config on 10 inputs (after the review fixes): `onerror` and `javascript:` removed,
  `<svg>` removed entirely, `style` / `class` / `data-*` / `target` / `<style>` / form controls removed,
  `<b>` / `<p>` / `id` / `https:` links kept. `/security` re-checked after the fixes.
- Headless Chrome, a sandboxed `srcdoc` iframe: the payload runs, but `parent.secret` and `document.cookie` throw `SecurityError`.
- The "Render without sanitizing" button was not clicked in a browser (headless has no clicks without Playwright).

## Review
- **code-reviewer, should-fix (fixed):** `class` was kept, so the app's own CSS (e.g. Tailwind `fixed inset-0`) could
  still draw the fake overlay that removing `style` was meant to stop. `class` is now always removed.
- **code-reviewer, should-fix (fixed):** the `srcdoc` iframe runs `<script>` too, unlike `innerHTML`. The demo text says so now.
- **code-reviewer, nits (fixed):** the raw output kept an old payload after the input changed, and a second click
  did nothing (same `srcDoc`). Now new input hides it and each click reloads the iframe (`key`). "Text-only comments"
  for `forbidTags: ['img']` was wrong (links, tables stay): now "no images".
- **security-reviewer, medium (fixed):** `data-*` attributes could reuse sonner's global `[data-sonner-toaster] { position: fixed }`
  rule for the same overlay. `ALLOW_DATA_ATTR: false`. `id` stays: Tailwind styles by class, and DOMPurify already
  blocks `id`/`name` values that would clobber DOM properties.
- **security-reviewer, low (fixed):** blocking `<form>` alone left `<input>`/`<button>`/`<select>`/`<textarea>`, which
  could fake a password field or add hidden fields to an app form around the content. They are removed too.
- **security-reviewer, low (postponed to 23d):** `<img src>` to any host works as a tracking pixel. Documented in the
  README (`forbidTags: ['img']`); the CSP's `img-src` in 23d is the fix. Added to known gaps.
- **security-reviewer:** the sandbox (`allow-scripts allow-modals`, no `allow-same-origin`) was confirmed as correct.

## Interview questions
1. **Is React safe from XSS by default?** For text, yes: `{value}` is escaped. The holes are `dangerouslySetInnerHTML`,
   user-controlled URLs (`href`, step 23b), and direct DOM access (`ref.current.innerHTML`, `eval`).
2. **Why does a `<script>` payload not work with `innerHTML`, and what do attackers use instead?** Browsers never run
   `<script>` inserted through `innerHTML`. Event handlers do run: `<img src=x onerror=...>`, `<svg onload=...>`.
3. **Sanitize when saving or when rendering?** When rendering, right before `dangerouslySetInnerHTML`. Data can come
   from many places (old rows, other APIs), and a sanitizer update then protects old data too. Store what the user typed.
