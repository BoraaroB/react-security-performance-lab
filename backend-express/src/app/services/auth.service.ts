import { randomUUID } from 'node:crypto';
import { AppError } from '../../lib/errors/index.js';
import type { AccessTokenService } from '../../lib/jwt/index.js';
import type { PasswordHasher } from '../../lib/password/index.js';
import { toPublicUser, type PublicUser, type UsersRepository } from '../repositories/users.repository.js';

export interface AuthDeps {
  users: UsersRepository;
  passwords: PasswordHasher;
  accessTokens: Pick<AccessTokenService, 'sign'>;
}

export interface AuthResult {
  accessToken: string;
  user: PublicUser;
}

/** Business logic of authentication. Knows nothing about HTTP requests; the controller does that. */
export function createAuthService({ users, passwords, accessTokens }: AuthDeps) {
  // A hash of a random password nobody knows, made with the same cost as real hashes. Login checks it when the
  // email does not exist, so that answer takes as long as a wrong password (see `login`). Started once, at startup.
  const dummyHash = passwords.hash(randomUUID());

  return {
    async login(email: string, password: string): Promise<AuthResult> {
      const user = users.findByEmail(email);
      // Always run bcrypt (~200 ms), even for an unknown email. Skipping it would answer unknown emails in ~1 ms,
      // and that difference alone tells an attacker which emails have an account (user enumeration).
      const valid = await passwords.verify(password, user?.passwordHash ?? (await dummyHash));
      // One code and one message for both cases, for the same reason: "no such user" would reveal the account list.
      if (!user || !valid) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');

      // The password is known to be correct only here, so this is the only moment an old hash (e.g. a lower cost
      // from earlier years) can be replaced with a stronger one.
      if (passwords.needsRehash(user.passwordHash)) {
        users.updatePasswordHash(user.id, await passwords.hash(password));
      }

      return { accessToken: accessTokens.sign({ sub: user.id }), user: toPublicUser(user) };
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
