import bcrypt from 'bcryptjs';

// bcrypt reads only the first 72 bytes of a password and silently ignores the rest: "<72 chars>A" and "<72 chars>B"
// would be the same password. So longer passwords are rejected instead of being cut without anyone noticing.
export const MAX_PASSWORD_BYTES = 72;

// Cost = log2 of the work: every +1 doubles the time per hash (cost 12 ≈ 200 ms in bcryptjs on a laptop).
// Below 10 is too fast to slow down offline guessing (OWASP minimum). Above 14 every login takes seconds of CPU,
// which turns the login route into an easy denial-of-service lever (and cost 31 would never finish).
const DEFAULT_COST = 12;
const MIN_COST = 10;
const MAX_COST = 14;

/** Thrown at startup for an invalid `cost`. */
export class PasswordHasherConfigError extends Error {
  readonly code = 'INVALID_PASSWORD_HASH_COST';
}

/** Thrown by `hash` for a password longer than 72 bytes (UTF-8). Validate the length before hashing. */
export class PasswordTooLongError extends Error {
  readonly code = 'PASSWORD_TOO_LONG';
  constructor() {
    super(`Password must be at most ${MAX_PASSWORD_BYTES} bytes`);
  }
}

export interface PasswordHasherOptions {
  /** bcrypt cost factor, 10–14. Default 12. */
  cost?: number;
}

export interface PasswordHasher {
  /** Hashes with a fresh random salt: the same password gives a different hash every time. */
  hash(password: string): Promise<string>;
  /** True only if the password matches. A malformed hash or a too-long password gives false, never an error. */
  verify(password: string, hash: string): Promise<boolean>;
  /** True if the hash was made with a different cost. Call after a successful login to upgrade old hashes. */
  needsRehash(hash: string): boolean;
}

/**
 * Passwords are hashed, never encrypted: a hash cannot be turned back into the password, even with the server's keys.
 * bcrypt is slow on purpose and salts every hash, so a leaked database cannot be cracked with precomputed tables
 * and every guess costs the attacker the same CPU time it costs us.
 */
export function createPasswordHasher(options: PasswordHasherOptions = {}): PasswordHasher {
  const cost = options.cost ?? DEFAULT_COST;
  if (!Number.isInteger(cost) || cost < MIN_COST || cost > MAX_COST) {
    throw new PasswordHasherConfigError(`cost must be an integer from ${MIN_COST} to ${MAX_COST}`);
  }

  return {
    async hash(password) {
      if (bcrypt.truncates(password)) throw new PasswordTooLongError();
      // The async version works in small chunks, so other requests are still served while a hash is computed.
      return bcrypt.hash(password, cost);
    },
    async verify(password, hash) {
      // Such a password was never accepted by `hash`, so it cannot be correct. Without this check, a too-long
      // password whose first 72 bytes match would be accepted.
      if (bcrypt.truncates(password)) return false;
      // compare() re-hashes with the cost stored in `hash`, so a planted "$2b$31$..." hash would pin the CPU for
      // hours. Lower costs are fine: old weak hashes must still verify, so needsRehash can upgrade them.
      if (!(bcrypt.getRounds(hash) <= MAX_COST)) return false;
      try {
        // Re-hashes with the salt stored in `hash` and compares in constant time.
        return await bcrypt.compare(password, hash);
      } catch {
        // A malformed hash (bad prefix or salt) rejects; for a login it is simply "wrong password", not a 500.
        return false;
      }
    },
    needsRehash(hash) {
      // getRounds() returns NaN for a malformed hash, so that also counts as "needs a new hash".
      return bcrypt.getRounds(hash) !== cost;
    },
  };
}
