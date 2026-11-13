import { createHash, randomBytes, randomUUID } from 'node:crypto';

// 32 random bytes = 256 bits: nobody can guess a valid token, so it needs no signature (it is not a JWT). The server
// looks it up instead, which is what makes it revocable.
const TOKEN_BYTES = 32;
// base64url of 32 bytes is always 43 characters. Anything else is rejected before touching the store.
const TOKEN_PATTERN = /^[\w-]{43}$/;
const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;
const DEFAULT_ABSOLUTE_TTL_SECONDS = 30 * 24 * 60 * 60;
const MAX_ABSOLUTE_TTL_SECONDS = 365 * 24 * 60 * 60;

/** Thrown at startup for a bad TTL. */
export class RefreshTokenConfigError extends Error {
  readonly code = 'INVALID_REFRESH_TOKEN_CONFIG';
}

/**
 * Thrown by `rotate`. `REFRESH_TOKEN_INVALID`: unknown, expired, or revoked. `REFRESH_TOKEN_REUSED`: an already used
 * token came back, so it was probably stolen; the whole family is revoked. Either way the client must log in again.
 */
export class RefreshTokenError extends Error {
  constructor(readonly code: 'REFRESH_TOKEN_INVALID' | 'REFRESH_TOKEN_REUSED') {
    super(code === 'REFRESH_TOKEN_REUSED' ? 'Refresh token was already used' : 'Invalid refresh token');
  }
}

/** One refresh token as stored. Times are milliseconds since the epoch. */
export interface RefreshTokenRecord {
  /** SHA-256 of the token. The token itself is never stored, so a leaked store holds no usable tokens. */
  tokenHash: string;
  userId: string;
  /** All tokens from one login share a family. Reuse of any old one revokes all of them. */
  familyId: string;
  expiresAt: number;
  /** The family's hard end: rotation never extends a session past it. */
  familyExpiresAt: number;
  /** Set when the token is rotated. A used token stays stored until `familyExpiresAt`, only to detect reuse. */
  usedAt: number | null;
}

/** Where records live. Async, so a database or Redis can implement it. */
export interface RefreshTokenStore {
  save(record: RefreshTokenRecord): Promise<void>;
  find(tokenHash: string): Promise<RefreshTokenRecord | undefined>;
  /**
   * Sets `usedAt` only if it is still `null`, in ONE atomic step, and returns `true` if this call set it. In SQL:
   * `UPDATE ... SET used_at = $2 WHERE token_hash = $1 AND used_at IS NULL`, then check the row count.
   */
  markUsed(tokenHash: string, usedAt: number): Promise<boolean>;
  /** Deletes EVERY record of the family, used ones included: `rotate` relies on that to detect a concurrent revoke. */
  deleteFamily(familyId: string): Promise<void>;
}

export interface RefreshTokenOptions {
  store: RefreshTokenStore;
  /** Lifetime of one token in seconds (sliding: each rotation starts a new one). Default 7 days. */
  ttlSeconds?: number;
  /** Lifetime of the whole family (one login) in seconds. Default 30 days. Must be ≥ `ttlSeconds`. */
  absoluteTtlSeconds?: number;
}

export interface IssuedRefreshToken {
  /** Send this to the client (in an httpOnly cookie). It is shown only once: the store keeps only its hash. */
  token: string;
  userId: string;
  expiresAt: Date;
}

export interface RefreshTokenService {
  /** Starts a new family (call it at login). */
  issue(userId: string): Promise<IssuedRefreshToken>;
  /** Uses up `token` and returns its replacement in the same family, or throws `RefreshTokenError`. */
  rotate(token: string): Promise<IssuedRefreshToken>;
  /**
   * Ends the session `token` belongs to: deletes its whole family. Never throws for a malformed, unknown, used or
   * expired token, so logout always succeeds and its answer reveals nothing about the token.
   */
  revoke(token: string): Promise<void>;
}

// A plain fast hash is enough here, unlike passwords: the token is 256 random bits, so there is nothing to brute-force.
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Opaque refresh tokens with rotation and reuse detection. */
export function createRefreshTokenService(options: RefreshTokenOptions): RefreshTokenService {
  const { store, ttlSeconds = DEFAULT_TTL_SECONDS, absoluteTtlSeconds = DEFAULT_ABSOLUTE_TTL_SECONDS } = options;
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 1) {
    throw new RefreshTokenConfigError('ttlSeconds must be a positive integer');
  }
  // An upper bound catches config typos (e.g. 1e13 seconds would be an invalid Date) at startup, not per request.
  if (!Number.isInteger(absoluteTtlSeconds) || absoluteTtlSeconds < ttlSeconds || absoluteTtlSeconds > MAX_ABSOLUTE_TTL_SECONDS) {
    throw new RefreshTokenConfigError(`absoluteTtlSeconds must be an integer from ttlSeconds to ${MAX_ABSOLUTE_TTL_SECONDS}`);
  }

  async function saveNewToken(userId: string, familyId: string, familyExpiresAt: number): Promise<IssuedRefreshToken> {
    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    const tokenHash = hashToken(token);
    const slidingExpiry = Date.now() + ttlSeconds * 1000;
    // Never past the family's end: a client that refreshes every day must still log in again after 30 days.
    const expiresAt = Math.min(slidingExpiry, familyExpiresAt);
    const record: RefreshTokenRecord = { tokenHash, userId, familyId, expiresAt, familyExpiresAt, usedAt: null };
    await store.save(record);
    return { token, userId, expiresAt: new Date(expiresAt) };
  }

  return {
    async issue(userId) {
      if (!userId) throw new Error('userId must be a non-empty string');
      const familyId = randomUUID();
      const familyExpiresAt = Date.now() + absoluteTtlSeconds * 1000;
      return saveNewToken(userId, familyId, familyExpiresAt);
    },

    async rotate(token) {
      if (!TOKEN_PATTERN.test(token)) throw new RefreshTokenError('REFRESH_TOKEN_INVALID');
      const tokenHash = hashToken(token);
      const record = await store.find(tokenHash);
      if (!record) throw new RefreshTokenError('REFRESH_TOKEN_INVALID');

      // Rotation: each token works once. If it was used before, two parties hold it (the user and a thief), and the
      // server cannot tell which one is calling now. So it revokes the whole family: the thief's newer token dies too,
      // and the real user just logs in again. Checked BEFORE expiry: a user back after a week with the old (stolen)
      // token must still trigger this, or the thief's session would live on.
      if (record.usedAt !== null) {
        await store.deleteFamily(record.familyId);
        throw new RefreshTokenError('REFRESH_TOKEN_REUSED');
      }
      const now = Date.now();
      if (record.expiresAt <= now) throw new RefreshTokenError('REFRESH_TOKEN_INVALID');

      // The same check again, as one atomic step: two requests racing with the same token can both pass the check
      // above, but only one of them can mark it used.
      const firstUse = await store.markUsed(tokenHash, now);
      if (!firstUse) {
        await store.deleteFamily(record.familyId);
        throw new RefreshTokenError('REFRESH_TOKEN_REUSED');
      }

      const next = await saveNewToken(record.userId, record.familyId, record.familyExpiresAt);

      // Race with a real database: a second request with the same token can lose `markUsed` and delete the family
      // BEFORE our save lands, and then the new token would live on in a revoked family. `deleteFamily` also removes
      // the used token, so if it is gone now, the family was revoked meanwhile: revoke again (with the new token).
      const stillThere = await store.find(tokenHash);
      if (!stillThere) {
        await store.deleteFamily(record.familyId);
        throw new RefreshTokenError('REFRESH_TOKEN_REUSED');
      }
      return next;
    },

    async revoke(token) {
      if (!TOKEN_PATTERN.test(token)) return;
      const tokenHash = hashToken(token);
      const record = await store.find(tokenHash);
      if (!record) return;
      // The whole family, not just this token: after rotation the browser holds only the newest token, but older
      // used ones (maybe a stolen copy) belong to the same login and must stop working too.
      await store.deleteFamily(record.familyId);
    },
  };
}
