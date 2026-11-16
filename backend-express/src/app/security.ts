// Glue: the app-wide encryptor, password hasher, access-token, CSRF-token and OAuth services, configured from `config`. One instance each, shared by everyone.
import { createEncryptor } from '../lib/crypto/index.js';
import { createCsrfTokenService } from '../lib/csrf/index.js';
import { createAccessTokenService } from '../lib/jwt/index.js';
import { createOAuthClient, GITHUB_ENDPOINTS, type OAuthClient } from '../lib/oauth/index.js';
import { createPasswordHasher } from '../lib/password/index.js';
import { config } from './config.js';

export const encryptor = createEncryptor({ key: config.dataEncryptionKey });

// Default cost 12 (≈ 200 ms per hash). Raise it when servers get faster; needsRehash upgrades old hashes at login.
export const passwords = createPasswordHasher();

// Fixed issuer/audience: a token signed with the same secret for another service or purpose is rejected.
// Default TTL: 15 minutes.
export const accessTokens = createAccessTokenService({
  secret: config.jwtSecret,
  issuer: 'react-security-lab-api',
  audience: 'react-security-lab-web',
});

export const csrfTokens = createCsrfTokenService({ secret: config.csrfSecret });

// Every supported OAuth provider. Adding one: its endpoints in lib/oauth/providers, its name here, its
// <NAME>_CLIENT_ID/SECRET in config.ts (plus its both-or-neither and production API_ORIGIN checks there), and a
// block below. Routes and cookies follow from the name.
export type OAuthProviderName = 'github';

/** Where a provider sends the browser back. Both the redirect URI and the state cookie's Path are built from it. */
export function oauthCallbackPath(provider: OAuthProviderName) {
  // Must match where app.ts mounts the auth router and the callback route in auth.routes.ts.
  return `/api/auth/oauth/${provider}/callback`;
}

// Only the configured providers. auth.routes.ts loops over it to register one fixed route each; it is never looked
// up with a name from the request.
export const oauthClients = new Map<OAuthProviderName, OAuthClient>();

if (config.oauth.github) {
  // No scopes: GitHub's minimum (the public profile) is enough to know who logs in.
  const github = createOAuthClient({
    ...GITHUB_ENDPOINTS,
    ...config.oauth.github,
    redirectUri: `${config.apiOrigin}${oauthCallbackPath('github')}`,
  });
  oauthClients.set('github', github);
}
