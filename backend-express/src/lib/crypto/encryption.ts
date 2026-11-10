import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32; // 256-bit key
const IV_BYTES = 12; // 96-bit IV: the size GCM is designed for (NIST SP 800-38D)
const TAG_BYTES = 16; // full 128-bit authentication tag
// Stored with every value, so a future format (e.g. a new key or algorithm) can be told apart from this one.
const FORMAT_VERSION = 'v1';

/** Thrown for any key problem at startup. */
export class EncryptionKeyError extends Error {
  readonly code = 'INVALID_ENCRYPTION_KEY';
}

/**
 * Thrown when a value cannot be decrypted: wrong key, wrong context, bad format, or tampered data.
 * One generic error for all cases on purpose: telling them apart would help an attacker probe the ciphertext.
 */
export class DecryptionError extends Error {
  readonly code = 'DECRYPTION_FAILED';
  constructor() {
    super('Could not decrypt the value');
  }
}

export interface Encryptor {
  /** Encrypts text. `context` (e.g. a user ID) is not stored, but the same value is required to decrypt. */
  encrypt(plaintext: string, context?: string): string;
  /** Reverses `encrypt`. Throws `DecryptionError` if anything was changed. */
  decrypt(payload: string, context?: string): string;
}

/**
 * Decodes a base64 key and checks that it is exactly 32 bytes. Node's base64 decoder silently skips invalid
 * characters, so the input is also re-encoded and compared: a typo must fail at startup, not produce a different key.
 */
export function parseEncryptionKey(base64: string): Buffer {
  const key = Buffer.from(base64, 'base64');
  if (key.length !== KEY_BYTES || key.toString('base64') !== base64) {
    throw new EncryptionKeyError(`must be ${KEY_BYTES} random bytes in base64 (44 characters)`);
  }
  return key;
}

/**
 * AES-256-GCM: encryption plus an authentication tag, so changed ciphertext is detected instead of decrypting to
 * garbage. Output: `v1.<iv>.<tag>.<ciphertext>` (base64url parts), safe to store as a plain string.
 */
export function createEncryptor(options: { key: Buffer }): Encryptor {
  if (options.key.length !== KEY_BYTES) throw new EncryptionKeyError(`key must be ${KEY_BYTES} bytes`);
  const key = Buffer.from(options.key); // own copy: the caller changing its buffer must not change our key

  return {
    encrypt(plaintext, context = '') {
      // A fresh random IV for every value. Reusing an IV with the same key breaks GCM completely (it leaks the XOR
      // of both plaintexts and lets an attacker forge tags). Random 96-bit IVs are safe for ~4 billion values per key.
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
      // Associated data: authenticated, not encrypted. Binds the value to its owner, so a ciphertext copied
      // from user A's row to user B's row fails to decrypt.
      cipher.setAAD(Buffer.from(context, 'utf8'));
      const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      return [FORMAT_VERSION, iv, cipher.getAuthTag(), ciphertext]
        .map((part) => (typeof part === 'string' ? part : part.toString('base64url')))
        .join('.');
    },

    decrypt(payload, context = '') {
      const [version, iv, tag, ciphertext, ...rest] = payload.split('.');
      if (version !== FORMAT_VERSION || iv === undefined || tag === undefined || ciphertext === undefined || rest.length > 0) {
        throw new DecryptionError();
      }
      try {
        // authTagLength makes Node reject a shortened tag; otherwise a 4-byte tag would be accepted and easy to guess.
        const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64url'), { authTagLength: TAG_BYTES });
        decipher.setAAD(Buffer.from(context, 'utf8'));
        decipher.setAuthTag(Buffer.from(tag, 'base64url'));
        // final() checks the tag; nothing is returned unless the whole value is authentic.
        const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]);
        return plaintext.toString('utf8');
      } catch {
        throw new DecryptionError();
      }
    },
  };
}
