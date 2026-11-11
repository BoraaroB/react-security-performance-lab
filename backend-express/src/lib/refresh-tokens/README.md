# refresh-tokens

Long-lived refresh tokens that the server can revoke. Each token is random, stored only as a SHA-256 hash, and works
once (rotation). If an already used token comes back, the whole family (every token from that login) is revoked, so a
stolen refresh token is caught the next time either the thief or the real user uses it.

## Dependencies
- npm: none (only `node:crypto`)
- lib: none

## Usage

```ts
import { createMemoryRefreshTokenStore, createRefreshTokenService, RefreshTokenError } from './lib/refresh-tokens/index.js';

const store = createMemoryRefreshTokenStore();
const refreshTokens = createRefreshTokenService({ store });

// Login: start a family. Put `token` in an httpOnly cookie; it is never stored in plain text.
const issued = await refreshTokens.issue(user.id); // { token, userId, expiresAt }

// Refresh: the old token is used up, the new one replaces it in the cookie.
try {
  const next = await refreshTokens.rotate(tokenFromCookie);
  // issue a new access token for next.userId
} catch (error) {
  if (error instanceof RefreshTokenError) {
    // error.code: 'REFRESH_TOKEN_INVALID' or 'REFRESH_TOKEN_REUSED' → 401, the client logs in again
  }
}
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `store` | `RefreshTokenStore` | – | Where records live. `createMemoryRefreshTokenStore()` or your own (database, Redis) |
| `ttlSeconds` | `number` | `604800` (7 days) | Lifetime of one token. Each rotation starts a new one (sliding) |
| `absoluteTtlSeconds` | `number` | `2592000` (30 days) | Lifetime of the whole family, at most 1 year. Rotation never goes past it |

## API

| Export | Description |
|---|---|
| `createRefreshTokenService(options)` | Returns `{ issue(userId), rotate(token) }`; both resolve to `{ token, userId, expiresAt }` |
| `RefreshTokenError` | Thrown by `rotate`, `code`: `REFRESH_TOKEN_INVALID` or `REFRESH_TOKEN_REUSED` |
| `RefreshTokenConfigError` | `code: 'INVALID_REFRESH_TOKEN_CONFIG'`, thrown by `createRefreshTokenService` |
| `createMemoryRefreshTokenStore()` | In-process `RefreshTokenStore` with `clear()` |
| `RefreshTokenStore` | Interface to implement your own store: `save`, `find`, `markUsed`, `deleteFamily` |

## Notes
- **Opaque, not a JWT.** A refresh token must be revocable, so the server looks it up anyway; a signature adds nothing.
- **Only the hash is stored.** A leaked database holds no usable tokens. SHA-256 is enough (no bcrypt): the token
  has 256 random bits, so there is nothing to guess.
- **`markUsed` must be atomic** in your own store (`UPDATE ... WHERE used_at IS NULL`). Otherwise two requests with
  the same stolen token could both get a new one, and the reuse would never be seen.
- **Two tabs refreshing at once** look like reuse and log the user out. The client should send one refresh at a time
  (single-flight) and share the result.
- **Used and expired records stay** in the memory store until restart (used ones are needed for reuse detection
  until the family ends). A database store should delete rows with `familyExpiresAt` in the past now and then.
- **`deleteFamily` must delete used records too.** After saving a new token, `rotate` checks that the used one is
  still there; if a parallel request revoked the family meanwhile, it is gone, and `rotate` revokes again.

## How to reuse
Copy `src/lib/refresh-tokens/`. No npm packages needed. In an ESM project, import with the `.js` extension; in
CommonJS (e.g. NestJS) drop it.
