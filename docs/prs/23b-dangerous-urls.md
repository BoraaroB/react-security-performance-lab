# PR 23b: Dangerous URLs (`safeUrl`)

## What and why
React escapes text, but a URL from a user (a profile "website", a link in a post) goes into `href` as is.
`javascript:alert(1)` there runs code in our page when clicked, and other schemes (`data:` phishing pages, ...) are
not wanted either. `safeUrl()` lets only `http:`, `https:` and `mailto:` through (an allowlist) and is used before
any `href`, `src`, `window.location` or `window.open`. A new section on `/security` shows it (goal.md: S1 XSS). Second of the four step-23 PRs.

## Changes
- `frontend/src/lib/sanitize/url.ts`: `safeUrl(url, { allowedProtocols? })`: parses with `new URL(url)` (no base, so
  only absolute URLs), checks `parsed.protocol` against the allowlist, rejects URLs with a user name
  (`https://example.com@evil.example`), returns the normalized `href` or `undefined`.
- `frontend/src/lib/sanitize/index.ts`: re-exports `safeUrl`. README: usage, options, notes (`data:`, open redirect, `noopener`).
- `frontend/src/features/security-demo/UrlDemo.tsx`: sample buttons (`javascript:` with case, spaces and a tab,
  `data:`, a fake host, a URL without scheme, https, mailto), an input, the `safeUrl()` result and the rendered link.
- `frontend/src/pages/SecurityPage.tsx`: adds the section.

## How to test
`npm run dev` in `frontend/` (no API needed), open http://localhost:5173/security, scroll to "Dangerous URLs".
1. "https" / "mailto": the result shows the URL, "Website" is a link.
2. "javascript:", "Mixed case + spaces", "Tab inside", "data: HTML": `undefined (blocked)`, "link removed".
3. "Fake host" (`https://example.com@evil.example/`) and "No scheme" (`www.example.com`): blocked too.

## How to reuse in another project
Copy `frontend/src/lib/sanitize/` (`url.ts` alone has no dependencies).
```tsx
import { safeUrl } from '@/lib/sanitize';

<a href={safeUrl(user.website)}>Website</a>        // undefined → not a link
const target = safeUrl(user.website, { allowedProtocols: ['https:'] });
if (target !== undefined) window.open(target, '_blank', 'noopener,noreferrer');
```
`safeUrl` checks the scheme, not the host: for redirects (`?next=...`) use a same-origin check instead.

## Verification
- `npm run typecheck`, `npm run lint`, `vite build`: OK (also after the review fixes). `SecurityPage` chunk 35.4 kB (was 33 kB); the main chunk is unchanged.
- The same check in Node and in headless Chrome on 12 inputs: `javascript:` (also with leading spaces, `\n`, `\u0000`,
  a tab inside, mixed case), `data:`, `vbscript:` → blocked; `www.example.com`, `/admin`, `//evil.example` → blocked
  (parse error); https and mailto → allowed, `HTTPS://Example.COM` → `https://example.com/`. After the review, in
  Node: `https://example.com@evil.example/` and `https://:pw@example.com` → blocked, `https://example.com/a@b` → allowed.
- Headless Chrome, `/security` on the dev server: the section renders, default `https` sample gives a real link.
- The sample buttons were not clicked in a browser (headless has no clicks without Playwright).

## Review
- **code-reviewer, should-fix (fixed):** the PR treated a `data:` link like `javascript:` XSS. Modern browsers do not
  open a top-level `data:` page and give it an opaque origin, so it cannot reach the app. Demo text, README and Q1 now
  say: `javascript:` runs in our origin (real XSS); `data:` is blocked by the allowlist too (phishing, older browsers).
  The sample's alert text no longer says "XSS".
- **code-reviewer, nit (fixed):** the `index.ts` top comment now mentions `safeUrl`.
- **security-reviewer, low (fixed):** the docs suggested `safeUrl` for `window.location`, but any http(s) host passes,
  so it does not stop open redirects. README note added; the reuse example is no longer a redirect.
- **security-reviewer, low (fixed):** `window.open` without `noopener` lets the opened page redirect our tab
  (reverse tabnabbing). README and the example use `'noopener,noreferrer'`.
- **security-reviewer, low (fixed):** `https://example.com@evil.example` passed (the host is `evil.example`).
  `safeUrl` now rejects URLs with a user name or password; a "Fake host" sample shows it.

## Interview questions
1. **React escapes everything, so why is `<a href={userUrl}>` an XSS risk?** Escaping stops HTML injection, not a
   dangerous scheme. `javascript:alert(1)` is a valid URL; clicking it runs code in your origin. React 19 now blocks
   `javascript:` in `href`, but not `window.location = url` or `window.open(url)`. (`data:` pages are no longer XSS
   in modern browsers, since they get their own opaque origin, but they are still used for phishing.)
2. **Why an allowlist and not `if (url.startsWith('javascript:'))`?** The browser ignores case, leading spaces and
   tabs inside the scheme (`"  JaVa\tScript:"` works), and there are other schemes (`data:`, `vbscript:`). Parsing with
   `new URL` and allowing only known-good schemes avoids all of that.
3. **Is the frontend check enough?** No. Validate the URL on the server when it is saved (e.g. Zod `z.url()` with a
   protocol check), because other clients (mobile app, emails) render the same data.
