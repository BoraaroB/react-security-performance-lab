# PR 20c: "Log in with GitHub" link and OAuth error messages

## What and why
The login page gets a "Log in with GitHub" link and shows a message when the API's GitHub callback (step 13c)
sends the browser back to `/login?error=OAUTH_FAILED | OAUTH_DENIED | OAUTH_EMAIL_TAKEN`. Covers S2 (OAuth on the
frontend) and S1: the `error` value comes from a URL anyone can craft, so only known codes get a message, and the
URL's own text is never rendered.

## Changes
- `src/config/http.ts`: exports `API_ORIGIN` (the same checked origin the HTTP clients use).
- `src/features/auth/auth.api.ts`: `GITHUB_LOGIN_URL` = `${API_ORIGIN}/api/auth/oauth/github`.
- `src/features/auth/auth.errors.ts`: `getOAuthErrorMessage(code)`: a `Map` of the 3 codes; unknown → `undefined`.
- `src/pages/LoginPage.tsx`: reads `?error=` (`useSearchParams`), shows the message, removes `error` from the URL on
  submit; the GitHub link is a plain `<a href>` styled as a button.

## How to test
```bash
cd backend-express && npm run dev
cd frontend && npm run dev
```
1. `http://localhost:5173/login?error=OAUTH_DENIED` → "GitHub login was cancelled." (also try the other two codes).
2. `/login?error=Your+account+is+locked.+Call+555-0100` or `/login?error=<img src=x onerror=alert(1)>` → no message.
3. With `?error=OAUTH_DENIED`, submit a wrong password → the URL loses `?error=`, only "Wrong email or password." shows.
4. With your GitHub OAuth App in `backend-express/.env` (`GITHUB_CLIENT_ID`/`SECRET`): click "Log in with GitHub",
   click "Cancel" on GitHub → back on `/login` with "GitHub login was cancelled.". Without them the link opens the API's 404 (Known gaps).

## How to reuse in another project
Nothing new to copy (app code). The pattern: a server-side OAuth start route + a plain link, and an allowlist for codes from the URL.
```tsx
const message = OAUTH_ERROR_MESSAGES.get(searchParams.get('error') ?? ''); // never render the raw value
<a href={`${API_ORIGIN}/api/auth/oauth/github`}>Log in with GitHub</a>
```

## Verification
- `npm run typecheck`, `npm run lint`, `vite build`: pass. Main file 384.8 → 385.7 kB (`useSearchParams` was not bundled before).
- Headless Chromium: the 3 codes show their texts; plain text, `__proto__` and HTML in `?error=` show nothing; a
  password submit removes `?error=`; the link's `href` is `http://localhost:4000/api/auth/oauth/github`.
- API started with dummy `GITHUB_CLIENT_ID`/`SECRET` (env vars only, nothing sent to GitHub): `GET /api/auth/oauth/github` → 302 to
  `github.com/login/oauth/authorize` with `state` + `code_challenge` (S256); the callback without the cookie → 302 to
  `http://localhost:5173/login?error=OAUTH_FAILED`. The real GitHub round trip was not run (no OAuth App credentials here).
- Size: 48 inserted / 4 deleted lines.

## Review
- **security-reviewer:** no findings.
- **code-reviewer** (1 should-fix + 1 nit, both fixed):
  - The code comment and the interview answer said "fetch cannot follow a redirect". That is wrong: fetch follows
    redirects by default. The real reasons are the top-level navigation (the user must use GitHub's page) and CORS.
    Both places are fixed.
  - The `OAUTH_EMAIL_TAKEN` text said "Log in with your password instead", but the existing account can also be
    password-less (made by another OAuth identity). It is now "Log in the way you signed up."
- Re-checked after the fixes: typecheck, lint, build, and the headless Chromium OAuth test.

## Interview questions
- **Why is "Log in with GitHub" a link and not a `fetch`?** OAuth needs a top-level navigation: the user must see
  and use GitHub's own page. fetch DOES follow redirects by default, but it only hands the response to JavaScript,
  and the cross-origin redirect to github.com would fail on CORS anyway (github.com sends no CORS headers).
- **Why not show `?error=` as it is?** Anyone can send a victim a link to our login page with any text in the URL
  (content injection: "Your account is locked, call …"). Only an allowlist of codes maps to our own texts.
- **How does the frontend get an access token after GitHub login?** Not through the URL (history, logs, Referer).
  The API sets only the refresh cookie and redirects to `/`; the app then calls `POST /api/auth/refresh` (step 21).
