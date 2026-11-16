# PR 13b: Start "Log in with GitHub" (`GET /api/auth/oauth/github`)

## What and why
The second of three PRs for "Log in with GitHub". It turns the `lib/oauth` client from 13a on (only when GitHub
credentials are configured) and adds the first route: it creates a fresh `state` + PKCE verifier, keeps both in a
short-lived httpOnly cookie, and redirects the browser to GitHub's login page. The callback (13c) will read that
cookie. goal.md topic: "authentication and authorization" (OAuth).

The cookie is the important part. It is `HttpOnly` (JavaScript never sees the verifier), `Secure` + `__Secure-`
prefix (cannot be planted over plain HTTP), `SameSite=Lax` (not `Strict`: the return from GitHub is a navigation
started on github.com, and a `Strict` cookie would not be sent then), `Path` = the callback only, and expires in 10 minutes.

## Changes
- `backend-express/src/app/config.ts`: optional `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET` (both or neither, else
  startup fails), optional `GITHUB_REDIRECT_URI` (default `http://localhost:<PORT>/api/auth/oauth/github/callback`;
  the path must be exactly that, and production requires `https://`).
- `backend-express/src/app/security.ts`: `githubOAuth` client, or `undefined` when GitHub login is off. No scopes.
- `backend-express/src/app/controllers/oauth.controller.ts` (new): `startGithubLogin` sets the cookie (`state.verifier`) and redirects.
- `backend-express/src/app/routes/auth.routes.ts`, `app.ts`: route registered only when `githubOAuth` exists (else 404).
- `backend-express/src/index.ts`: one info line at startup when GitHub login is off (explains the 404).
- `backend-express/.env.example`: the three variables, commented out.

## How to test
1. Create a GitHub OAuth App (https://github.com/settings/developers → New OAuth App), callback URL
   `http://localhost:4000/api/auth/oauth/github/callback`. Put `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in `backend-express/.env`.
2. `cd backend-express && npm run dev`, then:
```bash
curl -i http://localhost:4000/api/auth/oauth/github
```
Expected: `302`, `Location: https://github.com/login/oauth/authorize?...&state=...&code_challenge=...&code_challenge_method=S256`,
`Set-Cookie: __Secure-oauth_github=<state>.<verifier>; Max-Age=600; Path=/api/auth/oauth/github/callback; HttpOnly; Secure; SameSite=Lax`.
Open the same URL in a browser: GitHub asks you to authorize the app. After "Authorize", GitHub sends you to the
callback, which answers 404 until 13c. Without the two variables, the route answers 404 `NOT_FOUND`.

## How to reuse in another project
No new module: copy `lib/oauth` (13a) and this controller. The wiring:
```ts
const github = createOAuthClient({ ...GITHUB_ENDPOINTS, clientId, clientSecret, redirectUri });
router.get('/oauth/github', (_req, res) => {
  const { url, state, codeVerifier } = github.createAuthorizationRequest();
  res.cookie('__Secure-oauth_github', `${state}.${codeVerifier}`, { httpOnly: true, secure: true,
    sameSite: 'lax', path: '/api/auth/oauth/github/callback', maxAge: 10 * 60_000 });
  res.redirect(url);
});
```

## Verification
- `npm run typecheck` and `npm run build`: no errors.
- Smoke test (server on port 4100, fake credentials inline): GitHub off → 404 `NOT_FOUND` + the startup info line;
  on → 302 with the `Location` and `Set-Cookie` above, `Cache-Control: no-store`, `Referrer-Policy: no-referrer`; the
  verifier is not in the URL, and `SHA-256(verifier from the cookie)` equals `code_challenge`; the secret is not in
  the log. Only `GITHUB_CLIENT_ID` set → startup fails with "set both ... or neither". `GITHUB_REDIRECT_URI` with
  `http://` on a non-localhost host → startup fails with `OAuthConfigError` (from 13a).
- After the review fixes: a wrong path → "the path must be /api/auth/oauth/github/callback"; production without an
  https `GITHUB_REDIRECT_URI` → startup fails; production with one → 302 with that `redirect_uri`.

## Review
- **Fixed (both reviewers):** in production, a missing `GITHUB_REDIRECT_URI` fell back to the localhost callback
  without a warning. Now production with GitHub on requires an `https://` `GITHUB_REDIRECT_URI` (startup fails otherwise).
- **Fixed (code-reviewer):** a `GITHUB_REDIRECT_URI` with another path would never get the cookie (its `Path` is
  fixed), so every login would fail in 13c. The path must now be `/api/auth/oauth/github/callback` (`GITHUB_CALLBACK_PATH`).
- **Kept, documented (security-reviewer, low):** a hacked sibling subdomain can plant the `__Secure-` cookie (login
  CSRF). `__Host-` + `Path=/` would close it, but the cookie would then go with every API request; kept as planned,
  like the refresh cookie. Added to Known gaps, with a rule for 13c: never link GitHub to an already logged-in account
  (which would turn this into account takeover).
- **Accepted (code-reviewer, nit):** an `http://` non-localhost `GITHUB_REDIRECT_URI` in development stops startup with
  `OAuthConfigError` and a stack trace instead of the formatted list. It fails safely, and the message has no secret.

## Interview questions
1. **Why `SameSite=Lax` and not `Strict` for this cookie?** The return from GitHub is a top-level navigation started on
   another site. `Strict` cookies are never sent on cross-site requests, so the callback would not get its `state`.
   `Lax` is sent on top-level GET navigations, which is exactly this case, and still not on cross-site POSTs or iframes.
2. **Why is the verifier in a cookie and not in the redirect URL?** PKCE only works if the verifier stays secret until
   the code exchange. The URL goes through GitHub, browser history and logs; it carries only `SHA-256(verifier)`.
3. **Why no `?returnTo=` parameter?** A redirect target taken from the URL is an open redirect: an attacker could send
   a link to our real domain that ends on their phishing page. If ever needed, only a fixed list of paths is safe.
