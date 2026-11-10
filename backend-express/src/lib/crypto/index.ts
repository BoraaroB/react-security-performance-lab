// Authenticated encryption (AES-256-GCM) for sensitive data at rest: a leaked database or backup does not leak
// the plaintext, and changed ciphertext is detected instead of silently decrypting to wrong data.
export {
  createEncryptor,
  DecryptionError,
  EncryptionKeyError,
  parseEncryptionKey,
  type Encryptor,
} from './encryption.js';
