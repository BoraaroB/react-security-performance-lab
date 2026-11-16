# PR 13c: GitHub login callback (`GET /api/auth/oauth/github/callback`)

## What and why
The last of three PRs for "Log in with GitHub": after this, the login works end to end. GitHub sends the browser back
to our callback. We check `state` against the cookie from 13b, exchange the `code` (with the PKCE verifier) for
GitHub's token, read who logged in, find or create the account, and start OUR OWN session (the same refresh cookie as
a password login). goal.md topic: "authentication and authorization" (OAuth).

Three rules carry the security:
- **`state` first.** A callback this browser did not start (login CSRF), a replay, or an expired cookie stops before
  any call to GitHub. The cookie is cleared on success AND failure, so it works once.
- **Link by GitHub's user ID, never by email.** If someone registered the victim's email here with a password, auto-
  linking would let them keep that password into the victim's account (pre-account hijacking). An email that already
  has an account → `OAUTH_EMAIL_TAKEN`, nothing is linked.
- **Only a verified email.** Scope `user:email` lets us read `/user/emails`; only the primary AND verified address is used.

Every failure ends on the frontend's login page with a stable code (`/login?error=OAUTH_FAILED | OAUTH_DENIED |
OAUTH_EMAIL_TAKEN`), never a 500. No token is ever put in a URL.

## Changes
- `lib/oauth/providers/github.ts`: `GITHUB_SCOPES` (`user:email`), `fetchGithubProfile(accessToken)` → `OAuthProfile`
  (Zod-checked, no redirects, 10 s timeout, `OAuthError` on any failure). `core.ts`: the `OAuthProfile` type. README updated.
- `app/store.ts`, `repositories/users.repository.ts`: `passwordHash: string | null` (OAuth-only accounts),
  `userIdsByOAuthIdentity` index, `findByOAuthIdentity`, `addOAuthIdentity`.
- `services/auth.service.ts`: password login on an OAuth-only account → `INVALID_CREDENTIALS` (dummy hash, same timing);
  new `loginWithOAuth(profile)`. `schemas/auth.schemas.ts`: the name rules are exported as `userName` and reused.
- `schemas/oauth.schemas.ts` (new): the callback query. `controllers/oauth.controller.ts`: `callback`.
- `security.ts`: `oauthProviders` = Map of `{ client, fetchProfile }` (was `oauthClients`), so the controller stays generic.
- `config.ts`, `.env.example`: `FRONTEND_ORIGIN` (default `http://localhost:5173`, https in production with OAuth on).
- `auth.routes.ts`, `app.ts`, `index.ts`, `auth.controller.ts` (`setRefreshCookie` exported): wiring.

## How to test
With `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` in `backend-express/.env` (OAuth App callback
`http://localhost:4000/api/auth/oauth/github/callback`), run `cd backend-express && npm run dev` and open
`http://localhost:4000/api/auth/oauth/github` in the browser. After "Authorize", you land on
`http://localhost:5173/` (nothing runs there until step 14: "can't connect" is expected). DevTools → Application →
Cookies → `localhost`: `__Secure-refresh_token` exists and `__Secure-oauth_github` is gone. The server log shows
`GET /api/auth/oauth/github/callback → 302`. Click "Cancel" on GitHub instead → `.../login?error=OAUTH_DENIED`.

## How to reuse in another project
Copy `lib/oauth`. The callback in short:
```ts
if (!isSameState(savedState, query.state)) return fail('OAUTH_FAILED');
const { accessToken } = await github.exchangeCode(query.code, savedVerifier);
const profile = await fetchGithubProfile(accessToken); // scopes: GITHUB_SCOPES
const user = findByIdentity(profile.provider, profile.providerUserId) ?? createAndLink(profile); // never by email
startYourOwnSession(user); // then redirect to the frontend
```

## Verification
- `npm run typecheck` and `npm run build`: no errors. Portability grep: only the README example reads `process.env`.
- End-to-end script (temporary, not committed): the real app with a fake token endpoint that enforces PKCE
  (SHA-256 of the verifier must equal the challenge from the start URL) and a fake profile. 18/18 passed: new user →
  302 to `/`, refresh cookie set, state cookie cleared, no token in the URL, user has no password; `/refresh` with
  that cookie → 200; second login with the same GitHub ID (even a new email) → same account; wrong state, no cookie,
  `access_denied` without state, bad code, PKCE mismatch, `?code=a&code=b` → `OAUTH_FAILED` (cookie cleared too);
  `access_denied` → `OAUTH_DENIED`; email of a seeded account → `OAUTH_EMAIL_TAKEN`, nothing created or linked;
  invisible characters in the name → email local part; password login on the OAuth account → 401
  `INVALID_CREDENTIALS`; seeded password login still → 200. No token or verifier in the log.
- `fetchGithubProfile` with a mocked `fetch`: primary + verified → profile (`name` null → `login`); primary not
  verified → `OAuthError`; HTTP 401 → `OAuthError`; `id` as a string → `OAuthError`; `redirect: 'error'` and
  `Authorization: Bearer` sent to `https://api.github.com/user`; an odd secondary address no longer fails the list;
  an invalid primary → `OAuthError`.
- After the review fixes: the 18 cases still pass, and the dev request line shows
  `query: { "code": "[REDACTED]", "state": "[REDACTED]" }` while `err.code` (`OAUTH_FAILED`) stays visible.
- Not tested against real GitHub (needs the user's OAuth App): see "How to test".

## Review
- **Fixed (security, low):** in development the request line logs the query, so the callback's `code` and `state`
  reached the log. `lib/logger` got a `redactPaths` option (exact pino paths); the app redacts `query.code` and
  `query.state`. Not a bare `code` key: that would also hide `err.code` and every error code.
- **Fixed (code, should-fix):** no plan step showed the OAuth result on the frontend. Step 20 now includes the "Log in
  with GitHub" link and the `/login?error=...` messages.
- **Fixed (code, should-fix):** `z.email()` ran on every address from `/user/emails`, so one odd secondary address
  failed the whole login. Now only the chosen primary is checked (`z.email().max(254)`).
- **Fixed (code, nits):** the name fallback is cut to 100 characters and has no nested call; unexpected errors in the
  callback are also logged at `error` (still a redirect); the `OAUTH_EMAIL_TAKEN` comment no longer says "log in
  with your password" (the other account may have none); the callback route comment says honestly that the global
  limit caps calls to GitHub (a script can get a fresh state cookie each time); `cd backend-express` in "How to test".

## Interview questions
1. **Why not link a GitHub login to an existing account with the same email?** Pre-account hijacking: an attacker
   registers the victim's email with a password first. When the victim later logs in with GitHub and gets linked, the
   attacker's password still opens the same account. Link by the provider's stable user ID only; linking an existing
   account needs the user to prove they own it (log in with the password first).
2. **Why does the callback redirect to the frontend instead of returning JSON with the access token?** The browser got
   here by a navigation, not `fetch`, so there is no JavaScript to read JSON. A token in the redirect URL would land in
   history, logs and `Referer` headers. So only the httpOnly refresh cookie is set, and the frontend calls `/refresh`.
3. **What is the provider's access token used for?** Only to read the profile, server to server. It is not our
   session and never reaches the browser; our own access and refresh tokens are issued after the account is known.
