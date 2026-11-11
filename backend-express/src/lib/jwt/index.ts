// Short-lived JWT access tokens with a pinned algorithm and checked issuer/audience: a forged, altered, expired, or
// foreign token is rejected, and protected routes get a verified user ID instead of trusting the client.
export {
  AccessTokenConfigError,
  createAccessTokenService,
  InvalidTokenError,
  type AccessTokenClaims,
  type AccessTokenOptions,
  type AccessTokenService,
} from './core.js';
export { authenticate } from './express.js';
