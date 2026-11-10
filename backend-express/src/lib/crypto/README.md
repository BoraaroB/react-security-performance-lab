# crypto

Authenticated encryption (AES-256-GCM) for sensitive fields stored in a database. A leaked database or backup does not
leak the plaintext, and a changed value is rejected instead of silently decrypting to wrong data.

## Dependencies
- npm: none (Node's built-in `node:crypto`)
- lib: none

## Usage

```ts
import { createEncryptor, parseEncryptionKey } from './lib/crypto/index.js';

// The key comes from config (an env var), never from the code. Invalid key → throws at startup.
const encryptor = createEncryptor({ key: parseEncryptionKey(process.env.DATA_ENCRYPTION_KEY ?? '') });

const stored = encryptor.encrypt('Jane Doe', `users.name:${user.id}`); // "v1.<iv>.<tag>.<ciphertext>"
const name = encryptor.decrypt(stored, `users.name:${user.id}`);       // "Jane Doe", or throws DecryptionError
```

Generate a key: `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`.

## API

| Export | Description |
|---|---|
| `parseEncryptionKey(base64)` | Decodes a base64 key, checks it is exactly 32 bytes. Throws `EncryptionKeyError` (`INVALID_ENCRYPTION_KEY`) |
| `createEncryptor({ key })` | Returns `{ encrypt(text, context?), decrypt(payload, context?) }` |
| `DecryptionError` | `code: 'DECRYPTION_FAILED'`: wrong key, wrong context, bad format, or tampered data (one error for all) |

`context` (associated data) is authenticated but not stored. Pass the table, the column, and the row ID
(`users.name:${user.id}`): a value copied into another user's row, or into another encrypted column of the same row
(e.g. a secret token moved into a field the UI shows), then fails to decrypt. Use the same context for `encrypt` and `decrypt`.

## Notes
- Every `encrypt` call uses a new random 12-byte IV, so the same text gives a different output each time. A side effect:
  you cannot search for an encrypted value with `WHERE email = ...` (that needs a separate keyed hash, a "blind index").
- Encryption is for data you must read back (names, OAuth tokens). Passwords are **hashed**, never encrypted.
- Key rotation is not built in. The `v1.` prefix leaves room for it: a future version can carry a key ID.
- Output length ≈ 43 + 4/3 × input bytes (prefix, IV, tag, base64url). Size database columns with that.

## How to reuse
Copy `src/lib/crypto/`. No packages to install. In an ESM project, import with the `.js` extension;
in CommonJS (e.g. NestJS) drop it.
