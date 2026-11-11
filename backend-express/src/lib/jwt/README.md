# jwt

Short-lived JWT access tokens and an Express `authenticate` middleware. The algorithm is pinned (HS256) and the
issuer and audience are checked, so a forged, altered, expired, or foreign token is rejected, and protected routes get
a verified user ID (`req.auth.sub`) instead of trusting anything the client says.

## Dependencies
- npm: `jsonwebtoken@^9`, dev: `@types/jsonwebtoken@^9`
- lib: `errors` (only `express.ts`: the 401 is an `AppError`)

## Usage

```ts
import { authenticate, createAccessTokenService } from './lib/jwt/index.js';

const accessTokens = createAccessTokenService({
  secret: config.jwtSecret, // random, ≥ 32 bytes; shorter → throws AccessTokenConfigError at startup
  issuer: 'my-api',
  audience: 'my-web-app',
});

// Login: give the client a token.
res.json({ accessToken: accessTokens.sign({ sub: user.id }) });

// Protected route: the client sends `Authorization: Bearer <token>`.
router.get('/me', authenticate(accessTokens), (req, res) => res.json({ userId: req.auth!.sub }));
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `secret` | `string \| Buffer` | – | HMAC secret, at least 32 bytes. Generate it (`crypto.randomBytes(32)`), never type it |
| `issuer` | `string` | – | `iss` claim, checked on verify |
| `audience` | `string` | – | `aud` claim, checked on verify |
| `ttlSeconds` | `number` | `900` | Lifetime, 1–3600 seconds |

## API

| Export | Description |
|---|---|
| `createAccessTokenService(options)` | Returns `{ sign(claims), verify(token) }`. Claims: `{ sub }` (the user ID) |
| `authenticate(service)` | Express middleware: sets `req.auth`, or 401 `UNAUTHORIZED` / `TOKEN_EXPIRED` with `WWW-Authenticate: Bearer` |
| `InvalidTokenError` | Thrown by `verify`, `code`: `TOKEN_EXPIRED` or `TOKEN_INVALID` |
| `AccessTokenConfigError` | `code: 'INVALID_ACCESS_TOKEN_CONFIG'`, thrown by `createAccessTokenService` |

## Notes
- **Pinned algorithm.** `verify` accepts only HS256. Trusting the token's own `alg` header allows `alg: none`
  (no signature) and RS256 → HS256 confusion attacks.
- **Not encrypted.** Anyone can base64-decode the payload. Never put secrets or personal data in it.
- **Cannot be revoked.** A stolen access token works until it expires, so keep it short (15 min) and use revocable
  refresh tokens for long sessions.
- **Only the user ID.** No role or other data in the token: it would be a snapshot from login, so a role change or a
  deleted account would apply only after the token expires. Load the current user (and role) by `sub` after
  `authenticate`; a lookup by primary key is cheap. Microservices that cannot reach the user database usually put
  roles or scopes in a short-lived token instead (RFC 9068).
- **Header only.** `authenticate` reads only `Authorization: Bearer`, never a cookie. Store the token in memory on the
  client, not in `localStorage` (any XSS could read it there).
- **Expired vs invalid.** `TOKEN_EXPIRED` tells the client to refresh and retry; any other failure is plain
  `UNAUTHORIZED`, without the reason (that would only help an attacker).
- **Several services or key rotation:** use an asymmetric algorithm (RS256, EdDSA) with a `kid` header, so other
  services verify with a public key and cannot sign. This module covers one API with one secret.

## How to reuse
Copy `src/lib/jwt/` (and `src/lib/errors/` for the middleware), run `npm install jsonwebtoken@^9` and
`npm install -D @types/jsonwebtoken@^9`. In an ESM project, import with the `.js` extension; in CommonJS (e.g. NestJS)
drop it. Without Express, use only `core.ts`.
