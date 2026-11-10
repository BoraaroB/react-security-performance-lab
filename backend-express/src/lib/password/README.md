# password

Password hashing with bcrypt. A leaked database (or backup) does not reveal users' passwords: each hash has its own
random salt, and bcrypt is slow on purpose, so cracking even one password costs an attacker a lot of CPU time.

## Dependencies
- npm: `bcryptjs@^3` (pure JavaScript, ships its own types, no native build step)
- lib: none

## Usage

```ts
import { createPasswordHasher } from './lib/password/index.js';

const passwords = createPasswordHasher({ cost: 12 }); // invalid cost → throws at startup

// Register: store only the hash, never the password.
const passwordHash = await passwords.hash('User1234!'); // "$2b$12$<22-char salt><31-char hash>"

// Login:
if (!(await passwords.verify(input.password, user.passwordHash))) throw new AppError(401, 'INVALID_CREDENTIALS', '...');
if (passwords.needsRehash(user.passwordHash)) user.passwordHash = await passwords.hash(input.password);
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `cost` | `number` | `12` | Work factor, 10–14. Each +1 doubles the time per hash. Pick the highest that keeps login under ~250 ms on your server |

## API

| Export | Description |
|---|---|
| `createPasswordHasher(options?)` | Returns `{ hash, verify, needsRehash }` |
| `MAX_PASSWORD_BYTES` | `72`: the longest password bcrypt can handle. Use it in your validation schema (count UTF-8 bytes, not characters) |
| `PasswordTooLongError` | `code: 'PASSWORD_TOO_LONG'`, thrown by `hash` |
| `PasswordHasherConfigError` | `code: 'INVALID_PASSWORD_HASH_COST'`, thrown by `createPasswordHasher` |

## Notes
- **Hash, never encrypt.** Encrypted passwords can be decrypted by anyone who gets the key. Hashes cannot be reversed.
- **72-byte limit.** bcrypt silently ignores everything after 72 bytes. `hash` throws for longer passwords, and `verify`
  returns `false` for them. An emoji is 4 bytes, so 72 bytes can be as few as 18 characters of emoji.
- **`verify` never throws.** A malformed hash gives `false`. So does a stored hash with a cost above 14, because bcrypt
  trusts the cost written in the hash, and a planted `$2b$31$...` hash would pin the CPU. Lower costs still verify.
- **Changing the cost** applies to new hashes only. `needsRehash` + a re-hash after a successful login moves old users
  over without a reset.
- **CPU cost is a DoS risk.** Every login runs one full hash. Put a strict rate limit on login and register.
- **User enumeration:** if a login skips `verify` when the email does not exist, the fast response tells an attacker
  the account is missing. Run `verify` against a dummy hash in that case, so both paths take the same time.
- **Alternatives:** OWASP's first choice today is Argon2id (memory-hard, so GPUs help attackers less). Node 24.7+ has
  a built-in `crypto.argon2`, but it is still experimental. bcrypt is still acceptable and has no native dependency.
  `bcryptjs` is ~30% slower than the native `bcrypt` package; the async methods work in chunks, so the event loop keeps
  serving other requests.

## How to reuse
Copy `src/lib/password/` and run `npm install bcryptjs@^3`. In an ESM project, import with the `.js` extension;
in CommonJS (e.g. NestJS) drop it.
