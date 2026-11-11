// Revocable, long-lived refresh tokens: random and stored only as a hash, each one works once (rotation), and a reused
// old token revokes its whole family, so a stolen refresh token is caught the next time either side uses it.
export {
  createRefreshTokenService,
  RefreshTokenConfigError,
  RefreshTokenError,
  type IssuedRefreshToken,
  type RefreshTokenOptions,
  type RefreshTokenRecord,
  type RefreshTokenService,
  type RefreshTokenStore,
} from './core.js';
export { createMemoryRefreshTokenStore, type MemoryRefreshTokenStore } from './memory-store.js';
