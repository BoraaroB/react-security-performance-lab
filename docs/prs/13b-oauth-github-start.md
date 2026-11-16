# PR 13b: Start "Log in with GitHub" (`GET /api/auth/oauth/github`)

## What and why
The second of three PRs for "Log in with GitHub". It turns the `lib/oauth` client from 13a on (only when GitHub
credentials are configured) and adds the first route: it creates a fresh `state` + PKCE verifier, keeps both in a
short-lived httpOnly cookie, and redirects the browser to GitHub's login page. The callback (13c) will read that
cookie. A second commit (after the user's review) makes the routes and cookies provider-generic, so Google or
Microsoft later need no change in the controller or router. goal.md topic: "authentication and authorization" (OAuth).

The cookie is the important part. It is `HttpOnly` (JavaScript never sees the verifier), `Secure` + `__Secure-`
prefix (cannot be planted over plain HTTP), `SameSite=Lax` (not `Strict`: the return from GitHub is a navigation
started on github.com, and a `Strict` cookie would not be sent then), `Path` = the callback only, and expires in 10 minutes.

## Changes
- `backend-express/src/app/config.ts`: optional `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET` (both or neither, else
  startup fails) → `config.oauth.github`; optional `API_ORIGIN` (exact origin, default `http://localhost:<PORT>`,
  https required in production when a provider is on), from which callback URLs are built.
- `backend-express/src/app/security.ts`: `OAuthProviderName` (`'github'`), `oauthCallbackPath(provider)` (one source
  for the redirect URI and the cookie path), `oauthClients` (a Map with only the configured providers). No scopes.
- `backend-express/src/app/controllers/oauth.controller.ts` (new): `createOAuthController(provider, client)` → `start`:
  sets the `__Secure-oauth_<provider>` cookie (`state.verifier`) and redirects.
- `backend-express/src/app/routes/auth.routes.ts`, `app.ts`: one fixed `GET /oauth/<provider>` route per configured
  provider (not `/oauth/:provider`, so the URL name is never looked up); unknown providers → 404.
- `backend-express/src/index.ts`: startup info line with the list of `oauthProviders`.
- `backend-express/.env.example`: `API_ORIGIN`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, commented out.

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
No new module: copy `lib/oauth` (13a), `oauth.controller.ts`, and from `security.ts` the `OAuthProviderName` type and
`oauthCallbackPath()` (the controller imports both; change its import to wherever you put them). The wiring:
```ts
const clients = new Map<OAuthProviderName, OAuthClient>();
const redirectUri = `${apiOrigin}${oauthCallbackPath('github')}`;
clients.set('github', createOAuthClient({ ...GITHUB_ENDPOINTS, clientId, clientSecret, redirectUri }));
for (const [provider, client] of clients) {
  router.get(`/oauth/${provider}`, createOAuthController(provider, client).start);
}
```
Another provider = its endpoints file in `lib/oauth/providers`, its credentials, one more Map entry.

## Verification
- `npm run typecheck` and `npm run build`: no errors.
- Smoke test (server on port 4100, fake credentials inline): GitHub off → 404 `NOT_FOUND` + the startup info line;
  on → 302 with the `Location` and `Set-Cookie` above, `Cache-Control: no-store`, `Referrer-Policy: no-referrer`; the
  verifier is not in the URL, and `SHA-256(verifier from the cookie)` equals `code_challenge`; the secret is not in
  the log. Only `GITHUB_CLIENT_ID` set → startup fails with "set both ... or neither". An `http://` callback URL on a
  non-localhost host → startup fails with `OAuthConfigError` (from 13a).
- After the second commit (generic providers): the same 302 and cookie; `/oauth/google`, `/oauth/__proto__`,
  `/oauth/constructor` → 404; startup line `oauthProviders: []` or `["github"]`; `API_ORIGIN` with a path → startup
  fails; production with GitHub on and no https `API_ORIGIN` → startup fails; with `https://api.example.com` →
  `redirect_uri=https://api.example.com/api/auth/oauth/github/callback`.

## Review
First round (first commit):
- **Fixed (both reviewers):** in production, a missing redirect URI fell back to the localhost callback without a
  warning. Now production with an OAuth provider on requires an `https://` `API_ORIGIN` (startup fails otherwise).
- **Fixed (code-reviewer):** a redirect URI with another path would never get the cookie (its `Path` is fixed), so
  every login would fail in 13c. First fixed with a path check; the second commit removed the problem: there is no
  per-provider URL any more, only `API_ORIGIN`, and the path comes from `oauthCallbackPath()`.
- **Kept, documented (security-reviewer, low):** a hacked sibling subdomain can plant the `__Secure-` cookie (login
  CSRF). `__Host-` + `Path=/` would close it, but the cookie would then go with every API request; kept as planned,
  like the refresh cookie. Added to Known gaps, with a rule for 13c: never link a provider to an already logged-in
  account (which would turn this into account takeover).
- **Accepted (code-reviewer, nit):** an `http://` non-localhost `API_ORIGIN` in development stops startup with
  `OAuthConfigError` and a stack trace instead of the formatted list. It fails safely, and the message has no secret.

Second round (generic providers):
- security-reviewer: no findings.
- **Fixed (code-reviewer):** the "How to reuse" snippet did not compile (untyped Map, hard-coded callback path) and
  did not say the controller imports `OAuthProviderName` and `oauthCallbackPath` from `security.ts`.
- **Fixed (code-reviewer, nits):** the Map comment claimed the Map stops `__proto__` (the fixed routes do; the Map
  is never looked up by request input); the "adding a provider" comment now lists the two config checks too; a
  140-character comment in `app.ts` re-wrapped.

## Interview questions
1. **Why `SameSite=Lax` and not `Strict` for this cookie?** The return from GitHub is a top-level navigation started on
   another site. `Strict` cookies are never sent on cross-site requests, so the callback would not get its `state`.
   `Lax` is sent on top-level GET navigations, which is exactly this case, and still not on cross-site POSTs or iframes.
2. **Why is the verifier in a cookie and not in the redirect URL?** PKCE only works if the verifier stays secret until
   the code exchange. The URL goes through GitHub, browser history and logs; it carries only `SHA-256(verifier)`.
3. **Why no `?returnTo=` parameter?** A redirect target taken from the URL is an open redirect: an attacker could send
   a link to our real domain that ends on their phishing page. If ever needed, only a fixed list of paths is safe.
