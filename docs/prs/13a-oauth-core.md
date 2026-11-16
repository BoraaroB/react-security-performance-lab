# PR 13a: `lib/oauth`: Authorization Code flow with PKCE and `state`

## What and why
The first of three PRs for "Log in with GitHub" (step 13, split 13a/13b/13c by the user's choice). This PR adds only
the framework-free OAuth 2.0 client; no routes yet. It builds the provider's login URL with a random `state` and a
PKCE challenge, and trades the callback's `code` for the provider's access token. goal.md topic: "authentication and
authorization" (OAuth).

- **`state`** stops login CSRF: without it, an attacker could send the victim to our callback with the attacker's own
  `code`, and the victim would be logged into the attacker's account (and type private data into it).
- **PKCE (S256)** stops code injection: an attacker who steals a victim's `code` (browser history, logs, a Referer)
  cannot exchange it directly (no client secret), but could paste it into OUR callback from their own browser, so
  our server exchanges it with our secret. The login URL carries only `SHA-256(verifier)`, the token endpoint wants
  the verifier itself, and the attacker's login has a different one, so the provider refuses. The verifier stays in
  an httpOnly cookie of the browser that started the login (13b) and never appears in a URL.

## Changes
- `backend-express/src/lib/oauth/core.ts` (new): `createOAuthClient(options)` → `createAuthorizationRequest()`
  (`{ url, state, codeVerifier }`) and `exchangeCode(code, codeVerifier)` (`{ accessToken, scope }`);
  `isSameState(expected, received)` (constant time, never throws); `OAuthConfigError`, `OAuthError` (`OAUTH_FAILED`,
  `providerError` and `cause` for the log).
- `backend-express/src/lib/oauth/index.ts`, `README.md` (new): public API and usage.

Safety details in `exchangeCode`: URLs must be https (except `http://localhost`) and `timeoutMs` a positive integer,
checked at startup; redirects are
not followed (the client secret goes only to `tokenUrl`); 10 s timeout; GitHub's "error with HTTP 200" is detected;
the response is checked with Zod and `token_type` must be `bearer`.

## How to test
No route uses it yet (13b adds `GET /api/auth/oauth/github`). Quick check in `backend-express`:
```bash
cat > oauth-try.mts <<'EOF'
import { createOAuthClient } from './src/lib/oauth/index.js';
const github = createOAuthClient({ authorizeUrl: 'https://github.com/login/oauth/authorize',
  tokenUrl: 'https://github.com/login/oauth/access_token', clientId: 'x', clientSecret: 'y',
  redirectUri: 'http://localhost:4000/api/auth/oauth/github/callback', scopes: ['read:user'] });
console.log(github.createAuthorizationRequest());
EOF
npx tsx oauth-try.mts; rm oauth-try.mts
```
Expected: a GitHub URL with `state`, `code_challenge`, `code_challenge_method=S256`, and NOT the `codeVerifier`.

## How to reuse in another project
Copy `src/lib/oauth/`, `npm i zod`. See the README for a full example:
```ts
const github = createOAuthClient({ authorizeUrl, tokenUrl, clientId, clientSecret, redirectUri, scopes: ['read:user'] });
const { url, state, codeVerifier } = github.createAuthorizationRequest(); // save state + verifier, redirect to url
if (!isSameState(savedState, req.query.state)) throw new Error('state mismatch');
const { accessToken } = await github.exchangeCode(code, savedVerifier);
```

## Verification
- `npm run typecheck` and `npm run build`: no errors. Portability grep: only the README example reads `process.env`.
- Temporary script with a fake token server on `localhost`: challenge = SHA-256(verifier); verifier not in the URL;
  a new `state` each time; `isSameState` true only for the exact value (false for one changed character, `undefined`,
  an array). `exchangeCode`: valid JSON → tokens; GitHub-style `{ error: "bad_verification_code" }` with 200 →
  `OAuthError` with `providerError`; HTML 502 → `OAuthError`; a 307 redirect → not followed, `OAuthError` with
  `cause` "fetch failed"; no answer → `OAuthError` with `cause` "aborted due to timeout". The form body had all six
  fields. Config: `http://evil.com` token URL, `http://localhost.evil.com`, empty secret, an invalid redirect URI,
  `timeoutMs` -1 and 1.5 → `OAuthConfigError`.
- Size: `core.ts` + `index.ts` = 177 lines, 124 without comments and blank lines.

## Review
**security-reviewer:** no high/medium findings in the code. Three low ones, all guidance for 13b/13c, fixed in the docs:
- The cookie for `state` + verifier was only "short-lived httpOnly". Now the README and plan row 13b say:
  `HttpOnly; Secure; SameSite=Lax`, Path = callback, ~10 min, cleared on success and failure (single use). `Lax`,
  because the return from GitHub is a navigation started by another site, and the app's usual `Strict` cookies would
  not be sent with it, so every login would fail.
- "Verifier only our server holds" was wrong (13b puts it in a browser cookie). Reworded.
- The README callback example threw a plain `Error` (a 500) and passed raw query values. Now: validate the query with
  Zod, redirect to the login page with a stable error code, handle `?error=access_denied`. Added to plan row 13c.

**code-reviewer:**
- (should-fix) The docs explained PKCE as "a stolen code is useless". For a client with a secret, the real attack is
  **code injection** (the attacker pastes the victim's code into our callback). Fixed in `core.ts`, the README, this
  description and interview question 1.
- `OAuthError` dropped the network error: now it has `cause` (timeout, DNS, TLS and redirect can be told apart in the log).
- `timeoutMs` was not checked: now a positive integer, or `OAuthConfigError` at startup.
- `isSecureUrl` was a helper with one call site: inlined into the loop (`URL.parse`).
- README: Node 22+ (`URL.parse`), `redirectUri` must be https too. Interview question 1 now cites RFC 9700 (PKCE
  required for public clients, recommended for confidential ones) instead of "OAuth 2.1 requires".

## Interview questions
1. **Why PKCE if the server already has a client secret?** The secret proves which app is asking, not that this app
   started this login. A stolen `code` can be injected into our own callback, and our server would add the secret
   for the attacker. PKCE ties the `code` to the one login that created the verifier. The OAuth Security BCP
   (RFC 9700) requires PKCE for public clients and recommends it for confidential ones; the OAuth 2.1 draft
   requires it for all.
2. **What does `state` protect against, and where do you keep it?** Login CSRF (being logged into the attacker's
   account). It is random per login, kept on the server side of the browser that started it (an httpOnly cookie),
   and compared in the callback before anything else.
3. **Why not use the GitHub access token as our session?** It is a credential for GitHub's API, with GitHub's scopes and
   lifetime. We read the profile once and issue our own short-lived JWT + refresh cookie, so our session rules
   (rotation, revocation, roles) stay in our hands, and the GitHub token never reaches the browser.
