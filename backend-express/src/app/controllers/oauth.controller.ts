import type { CookieOptions, RequestHandler } from 'express';
import type { OAuthClient } from '../../lib/oauth/index.js';
import { oauthCallbackPath, type OAuthProviderName } from '../security.js';

/** One controller per provider: same flow, but its own cookie and callback path. */
export function createOAuthController(provider: OAuthProviderName, client: OAuthClient) {
  // Keeps this login's `state` and PKCE verifier until the provider sends the browser back. One cookie per provider,
  // so a GitHub login in one tab and a Google login in another do not overwrite each other. `__Secure-`: browsers
  // accept it only over HTTPS with `Secure`, so a plain-HTTP response cannot plant an attacker's values.
  const cookieName = `__Secure-oauth_${provider}`;

  // Shared by set (here) and clear (the callback): a browser deletes a cookie only when name and path match.
  const cookieOptions: CookieOptions = {
    httpOnly: true, // the verifier must never reach JavaScript
    secure: true,
    // Lax, not Strict: the return from the provider is a navigation started on its site, and a Strict cookie is not
    // sent then.
    sameSite: 'lax',
    path: oauthCallbackPath(provider), // sent only to this provider's callback, not to the rest of the API
    maxAge: 10 * 60_000, // a login that is not finished within 10 minutes must start over
  };

  const start: RequestHandler = (_req, res) => {
    const { url, state, codeVerifier } = client.createAuthorizationRequest();
    // Both are base64url (never a "."), so one cookie holds both and the callback splits it at the ".".
    res.cookie(cookieName, `${state}.${codeVerifier}`, cookieOptions);
    // `url` is built only from our config: no user input, so this cannot become an open redirect.
    res.redirect(url);
  };

  return { start };
}
