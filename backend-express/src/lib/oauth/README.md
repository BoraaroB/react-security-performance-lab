# oauth

"Log in with GitHub" (or any OAuth 2.0 provider) using the Authorization Code flow with PKCE and `state`. `state`
stops login CSRF (an attacker logging the victim into the attacker's account), and PKCE stops code injection: a
stolen authorization code works only together with the verifier of the login that requested it.

## Dependencies
- npm: `zod@^4` (checks the token response); Node 22+ (built-in `fetch`, `URL.parse`)
- lib: none

## Usage

```ts
import { createOAuthClient, GITHUB_ENDPOINTS, isSameState, OAuthError } from './lib/oauth/index.js';

const github = createOAuthClient({
  ...GITHUB_ENDPOINTS,
  clientId: process.env.GITHUB_CLIENT_ID!,
  clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  redirectUri: 'http://localhost:4000/api/auth/oauth/github/callback',
  scopes: ['read:user', 'user:email'],
});

// 1. Start: keep `state` + `codeVerifier` in a short-lived httpOnly cookie (see Notes), then redirect to `url`.
const { url, state, codeVerifier } = github.createAuthorizationRequest();

// 2. Callback (?code=...&state=... or ?error=access_denied): validate the query with Zod (strings, max length),
//    clear the cookie, check state FIRST, then exchange the code. Every failure → redirect to the login page with a
//    stable error code (not a 500).
if (!isSameState(savedState, query.state)) return res.redirect('/login?error=OAUTH_FAILED');
try {
  const { accessToken } = await github.exchangeCode(query.code, savedCodeVerifier);
  // call the provider's API with accessToken (e.g. GET https://api.github.com/user)
} catch (error) {
  if (error instanceof OAuthError) {
    // log error.providerError (e.g. 'bad_verification_code'), then redirect to the login page
  }
}
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `authorizeUrl` | `string` | – | Provider's login page; https (or `http://localhost`) |
| `tokenUrl` | `string` | – | Provider's token endpoint; https (the secret is sent there) |
| `clientId` | `string` | – | From the provider's app settings |
| `clientSecret` | `string` | – | From the provider's app settings; keep it in `.env` |
| `redirectUri` | `string` | – | Our callback, exactly as registered at the provider; https (or `http://localhost`) |
| `scopes` | `string[]` | `[]` | Ask for the minimum you need |
| `timeoutMs` | `number` | `10000` | Timeout for the code exchange; a positive integer |

## Providers
`core.ts` is the same for every provider (all security logic lives there, written and reviewed once). Each provider
gets one small file in `providers/` with only what differs: its endpoints (and, later, reading its user profile).
To add Google, create `providers/google.ts`:
```ts
export const GOOGLE_ENDPOINTS = {
  authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
};
```

## Notes
- **PKCE (S256):** the login URL carries only `SHA-256(verifier)`. The verifier never appears in a URL: it stays in
  the httpOnly cookie of the browser that started the login, and our server sends it to the token endpoint. A thief
  cannot exchange a stolen `code` directly (no client secret), so the real attack is **code injection**: pasting the
  victim's `code` into OUR callback from the attacker's own browser, so that our server exchanges it with our secret.
  The attacker's login has a different verifier, so the provider refuses.
- **`state`:** a random value bound to the browser that started the login. Without it, an attacker could send the
  victim to our callback with the attacker's own `code` and log the victim into the attacker's account.
- **The `state` + verifier cookie:** `HttpOnly; Secure; SameSite=Lax`, `Path` = the callback route, `Max-Age` about
  10 minutes. `Lax`, not `Strict`: the provider sends the user back with a navigation started on its site, and a
  `Strict` cookie would not be sent with it (every login would fail). Never `SameSite=None`. The callback clears it on
  success AND failure, so one pair works only once. Anyone with both the cookie and the `code` can finish the login,
  so never log it.
- **The provider's access token is not our session.** Use it once to read the user's profile, then issue our own
  tokens. Never send it to the browser.
- **Redirects are not followed** on the code exchange, so the client secret goes only to `tokenUrl`.
- **GitHub specifics:** it answers errors with HTTP 200 and `{ "error": ... }` (handled), and needs
  `Accept: application/json` (sent).

## How to reuse
Copy `src/lib/oauth/` and install `zod`. `core.ts` has no framework code (use it from a Nest controller too).
In an ESM project, import with the `.js` extension; in CommonJS (e.g. NestJS) drop it.
