// "Log in with GitHub/Google/...": OAuth 2.0 Authorization Code flow with PKCE and `state`, so a login cannot be
// forced on a user (login CSRF) and a stolen authorization code cannot be injected into another login (PKCE).
export {
  createOAuthClient,
  isSameState,
  OAuthConfigError,
  OAuthError,
  type AuthorizationRequest,
  type OAuthClient,
  type OAuthClientOptions,
  type OAuthProfile,
  type OAuthTokens,
} from './core.js';
export { fetchGithubProfile, GITHUB_ENDPOINTS, GITHUB_SCOPES } from './providers/github.js';
