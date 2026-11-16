import type { CookieOptions, RequestHandler } from 'express';
import type { OAuthClient } from '../../lib/oauth/index.js';

// Keeps this login's `state` and PKCE verifier until GitHub sends the browser back to the callback. `__Secure-`:
// browsers accept it only over HTTPS with `Secure`, so a plain-HTTP response cannot plant an attacker's values.
const GITHUB_COOKIE = '__Secure-oauth_github';

// Shared by set (here) and clear (the callback): a browser deletes a cookie only when name and path match.
const GITHUB_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true, // the verifier must never reach JavaScript
  secure: true,
  // Lax, not Strict: the return from GitHub is a navigation started on github.com, and a Strict cookie is not sent then.
  sameSite: 'lax',
  // Must match where app.ts mounts the auth router and GITHUB_CALLBACK_PATH in config.ts. Sent only to the callback.
  path: '/api/auth/oauth/github/callback',
  maxAge: 10 * 60_000, // a login that is not finished within 10 minutes must start over
};

export function createOAuthController(github: OAuthClient) {
  const startGithubLogin: RequestHandler = (_req, res) => {
    const { url, state, codeVerifier } = github.createAuthorizationRequest();
    // Both are base64url (never a "."), so one cookie holds both and the callback splits it at the ".".
    res.cookie(GITHUB_COOKIE, `${state}.${codeVerifier}`, GITHUB_COOKIE_OPTIONS);
    // `url` is built only from our config: no user input, so this cannot become an open redirect.
    res.redirect(url);
  };

  return { startGithubLogin };
}
