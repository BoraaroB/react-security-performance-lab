// GitHub's OAuth endpoints: `createOAuthClient({ ...GITHUB_ENDPOINTS, clientId, clientSecret, redirectUri })`.
// Everything GitHub-specific lives in this file; core.ts (PKCE, state, code exchange) stays the same for every provider.
export const GITHUB_ENDPOINTS = {
  authorizeUrl: 'https://github.com/login/oauth/authorize',
  tokenUrl: 'https://github.com/login/oauth/access_token',
};
