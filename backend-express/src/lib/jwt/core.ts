import jwt from 'jsonwebtoken';

// Pinned: tokens are signed AND verified only with HS256. If verify trusted the `alg` in the token's header, an
// attacker could send `alg: none` (no signature at all) or switch an RS256 setup to HS256 and sign with the public key.
const ALGORITHM = 'HS256';
// HS256 is only as strong as its secret: below 32 bytes (256 bits) it can be brute-forced offline from one token.
const MIN_SECRET_BYTES = 32;
// Short on purpose: an access token cannot be revoked, so a stolen one works until it expires. Longer sessions use
// refresh tokens, which the server CAN revoke.
const DEFAULT_TTL_SECONDS = 15 * 60;
const MAX_TTL_SECONDS = 60 * 60;

/** Thrown at startup for a weak secret or a bad TTL. */
export class AccessTokenConfigError extends Error {
  readonly code = 'INVALID_ACCESS_TOKEN_CONFIG';
}

/** Thrown by `verify`. `TOKEN_EXPIRED` means "refresh and retry"; `TOKEN_INVALID` means "log in again". */
export class InvalidTokenError extends Error {
  constructor(readonly code: 'TOKEN_EXPIRED' | 'TOKEN_INVALID') {
    super(code === 'TOKEN_EXPIRED' ? 'Access token expired' : 'Invalid access token');
  }
}

export interface AccessTokenOptions {
  /** HMAC secret, at least 32 bytes. Use a random value, never a word or a password. */
  secret: string | Buffer;
  /** `iss` claim: who issued the token (this API). */
  issuer: string;
  /** `aud` claim: who the token is for. A token made for another service is rejected. */
  audience: string;
  /** Lifetime in seconds, 1–3600. Default 900 (15 minutes). */
  ttlSeconds?: number;
}

/** What a valid token says: the user's ID and role. */
export interface AccessTokenClaims {
  sub: string;
  role: string;
}

export interface AccessTokenService {
  sign(claims: AccessTokenClaims): string;
  /** Returns the claims of a valid token, or throws `InvalidTokenError`. */
  verify(token: string): AccessTokenClaims;
}

/**
 * Stateless access tokens (JWT): the server checks the signature instead of looking up a session, so any instance
 * can verify a token. The payload is only base64, not encrypted: never put secrets or personal data in it.
 */
export function createAccessTokenService(options: AccessTokenOptions): AccessTokenService {
  const { secret, issuer, audience, ttlSeconds = DEFAULT_TTL_SECONDS } = options;
  if (Buffer.byteLength(secret) < MIN_SECRET_BYTES) {
    throw new AccessTokenConfigError(`secret must be at least ${MIN_SECRET_BYTES} bytes`);
  }
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > MAX_TTL_SECONDS) {
    throw new AccessTokenConfigError(`ttlSeconds must be an integer from 1 to ${MAX_TTL_SECONDS}`);
  }

  return {
    sign({ sub, role }) {
      // `verify` rejects an empty `sub`, so such a token would fail on every request: fail here, where the bug is.
      if (!sub) throw new Error('sub must be a non-empty string');
      return jwt.sign({ role }, secret, { algorithm: ALGORITHM, expiresIn: ttlSeconds, issuer, audience, subject: sub });
    },
    verify(token) {
      let payload: string | jwt.JwtPayload;
      try {
        // Checks the signature, `exp`, `nbf`, `iss`, and `aud`. Without `issuer`/`audience` here, a token signed with
        // the same secret for another purpose or service would be accepted too.
        payload = jwt.verify(token, secret, { algorithms: [ALGORITHM], issuer, audience });
      } catch (error) {
        // The library's reason ("invalid signature", "jwt audience invalid", ...) stays here: it only helps an attacker.
        throw new InvalidTokenError(error instanceof jwt.TokenExpiredError ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID');
      }
      // jsonwebtoken does not require `exp`: a token without it would never expire. `sign` always sets it, so a
      // missing one means the token was not made by `sign`.
      if (typeof payload === 'string' || typeof payload.exp !== 'number') throw new InvalidTokenError('TOKEN_INVALID');
      const { sub, role } = payload;
      if (typeof sub !== 'string' || !sub || typeof role !== 'string') throw new InvalidTokenError('TOKEN_INVALID');
      return { sub, role };
    },
  };
}
