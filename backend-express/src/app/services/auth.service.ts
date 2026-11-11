import { randomUUID } from 'node:crypto';
import { AppError } from '../../lib/errors/index.js';
import type { AccessTokenService } from '../../lib/jwt/index.js';
import type { PasswordHasher } from '../../lib/password/index.js';
import {
  EmailTakenError,
  toPublicUser,
  type PublicUser,
  type User,
  type UsersRepository,
} from '../repositories/users.repository.js';

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

  function issueTokens(user: User): AuthResult {
    return { accessToken: accessTokens.sign({ sub: user.id }), user: toPublicUser(user) };
  }

  // Register logs the user in at once, so a free email gets 201 and a taken one cannot get the same answer: it WILL
  // reveal that the account exists. Hiding that needs an email-verification flow ("check your inbox" for both cases).
  // Here the honest 409 is used, and the strict register limiter keeps mass checking slow.
  const emailTaken = () => new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');

  return {
    async register(input: { name: string; email: string; password: string }): Promise<AuthResult> {
      // Fast path: no ~200 ms of bcrypt for an email that is clearly taken.
      if (users.findByEmail(input.email)) throw emailTaken();
      const passwordHash = await passwords.hash(input.password);
      try {
        // The role is set here, never taken from the request.
        return issueTokens(users.create({ name: input.name, email: input.email, passwordHash, role: 'user' }));
      } catch (error) {
        // Two registrations with the same email can both pass the check above while they await the hash; `create`
        // is the real guard. Same answer as the fast path, not a 500.
        if (error instanceof EmailTakenError) throw emailTaken();
        throw error;
      }
    },

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

      return issueTokens(user);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
