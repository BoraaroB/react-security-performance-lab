import type { CookieOptions, RequestHandler } from 'express';
import { AppError } from '../../lib/errors/index.js';
import { isSameState, OAuthError } from '../../lib/oauth/index.js';
import { config } from '../config.js';
import { oauthCallbackQuerySchema } from '../schemas/oauth.schemas.js';
import { oauthCallbackPath, type OAuthProvider, type OAuthProviderName } from '../security.js';
import type { AuthService } from '../services/auth.service.js';
import { setRefreshCookie } from './auth.controller.js';

// Stable codes for the frontend's login page (`/login?error=...`); it maps them to messages.
type OAuthFailure = 'OAUTH_FAILED' | 'OAUTH_DENIED' | 'OAUTH_EMAIL_TAKEN';

/** One controller per provider: same flow, but its own cookie and callback path. */
export function createOAuthController(
  provider: OAuthProviderName,
  { client, fetchProfile }: OAuthProvider,
  auth: AuthService,
) {
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

  const callback: RequestHandler = async (req, res) => {
    // Single use: cleared on success AND failure, so one state + verifier pair can never finish a second login.
    const savedValue: unknown = req.cookies[cookieName];
    res.clearCookie(cookieName, cookieOptions);

    // Every failure ends on the frontend's login page with a stable code, never a 500 or JSON: the user got here by
    // a navigation. The details are for operators, so they go only to the log.
    const fail = (code: OAuthFailure, details: object) => {
      req.log.warn({ provider, ...details }, `OAuth login failed: ${code}`);
      res.redirect(`${config.frontendOrigin}/login?error=${code}`);
    };

    const query = oauthCallbackQuerySchema.safeParse(req.query);
    if (!query.success) return fail('OAUTH_FAILED', { reason: 'invalid query' });
    const { code, state, error } = query.data;
    // cookie-parser turns a value that starts with "j:" into an object, so only a string can be ours.
    const [savedState, codeVerifier] = typeof savedValue === 'string' ? savedValue.split('.') : [];

    // State FIRST: a callback this browser did not start (login CSRF), a replay, or an expired cookie stops here.
    if (!isSameState(savedState, state)) return fail('OAUTH_FAILED', { reason: 'state mismatch' });
    // The user clicked "Cancel" on the provider's page.
    if (error === 'access_denied') return fail('OAUTH_DENIED', { providerError: error });
    if (error || !code || !codeVerifier) return fail('OAUTH_FAILED', { reason: 'no code', providerError: error });

    try {
      const tokens = await client.exchangeCode(code, codeVerifier);
      const profile = await fetchProfile(tokens.accessToken);
      const result = await auth.loginWithOAuth(profile);
      setRefreshCookie(res, result.refreshToken);
      // Only the refresh cookie: the frontend gets its access token from POST /refresh, never through a URL (URLs
      // end up in the browser history, logs and Referer headers). The provider's token is dropped here.
      res.redirect(`${config.frontendOrigin}/`);
    } catch (err) {
      // Still a redirect, but anything that is not an expected OAuth or app error is a bug: log it as an error too.
      const isExpected = err instanceof OAuthError || err instanceof AppError;
      if (!isExpected) req.log.error({ provider, err }, 'OAuth login crashed');
      const isEmailTaken = err instanceof AppError && err.code === 'OAUTH_EMAIL_TAKEN';
      fail(isEmailTaken ? 'OAUTH_EMAIL_TAKEN' : 'OAUTH_FAILED', { err });
    }
  };

  return { start, callback };
}
