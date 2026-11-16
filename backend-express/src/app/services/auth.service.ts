import { randomUUID } from 'node:crypto';
import { AppError } from '../../lib/errors/index.js';
import type { AccessTokenService } from '../../lib/jwt/index.js';
import type { OAuthProfile } from '../../lib/oauth/index.js';
import type { PasswordHasher } from '../../lib/password/index.js';
import {
  RefreshTokenError,
  type IssuedRefreshToken,
  type RefreshTokenService,
} from '../../lib/refresh-tokens/index.js';
import {
  EmailTakenError,
  toPublicUser,
  type PublicUser,
  type User,
  type UsersRepository,
} from '../repositories/users.repository.js';
import { userName } from '../schemas/auth.schemas.js';

export interface AuthDeps {
  users: UsersRepository;
  passwords: PasswordHasher;
  accessTokens: Pick<AccessTokenService, 'sign'>;
  refreshTokens: RefreshTokenService;
}

export interface AuthResult {
  accessToken: string;
  /**
   * Web: goes only into the httpOnly cookie, never into the JSON body (JavaScript, and so XSS, could read it there).
   * Mobile: goes into the JSON body, but only on /api/mobile routes, which have no CORS (see app.ts).
   * So never `res.json()` an AuthResult as it is: each controller picks the fields it may send.
   */
  refreshToken: IssuedRefreshToken;
  user: PublicUser;
}

/** Business logic of authentication. Knows nothing about HTTP requests; the controller does that. */
export function createAuthService({ users, passwords, accessTokens, refreshTokens }: AuthDeps) {
  // A hash of a random password nobody knows, made with the same cost as real hashes. Login checks it when the
  // email does not exist, so that answer takes as long as a wrong password (see `login`). Started once, at startup.
  const unknownPassword = randomUUID();
  const dummyHash = passwords.hash(unknownPassword);

  function toAuthResult(user: User, refreshToken: IssuedRefreshToken): AuthResult {
    const accessToken = accessTokens.sign({ sub: user.id });
    const publicUser = toPublicUser(user);
    return { accessToken, refreshToken, user: publicUser };
  }

  // Login and register start a new session: a new refresh-token family.
  async function startSession(user: User): Promise<AuthResult> {
    const refreshToken = await refreshTokens.issue(user.id);
    return toAuthResult(user, refreshToken);
  }

  // One answer for every refresh failure (no cookie, unknown, expired, reused, deleted user). Telling them apart
  // would only help someone holding a stolen token; the client does the same thing in every case: log in again.
  const sessionEnded = () => new AppError(401, 'UNAUTHORIZED', 'Session expired, please log in again');

  // Register logs the user in at once, so a free email gets 201 and a taken one cannot get the same answer: it WILL
  // reveal that the account exists. Hiding that needs an email-verification flow ("check your inbox" for both cases).
  // Here the honest 409 is used, and the strict register limiter keeps mass checking slow.
  const emailTaken = () => new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');

  return {
    async register(input: { name: string; email: string; password: string }): Promise<AuthResult> {
      // Fast path: no ~200 ms of bcrypt for an email that is clearly taken.
      if (users.findByEmail(input.email)) throw emailTaken();
      const passwordHash = await passwords.hash(input.password);
      let user: User;
      try {
        // The role is set here, never taken from the request.
        user = users.create({ name: input.name, email: input.email, passwordHash, role: 'user' });
      } catch (error) {
        // Two registrations with the same email can both pass the check above while they await the hash; `create`
        // is the real guard. Same answer as the fast path, not a 500.
        if (error instanceof EmailTakenError) throw emailTaken();
        throw error;
      }
      return startSession(user);
    },

    async login(email: string, password: string): Promise<AuthResult> {
      const user = users.findByEmail(email);
      // Always run bcrypt (~200 ms), even for an unknown email. Skipping it would answer unknown emails in ~1 ms,
      // and that difference alone tells an attacker which emails have an account (user enumeration).
      // An OAuth-only account has no password: it gets the dummy hash too, so it answers like a wrong password.
      const hashToCheck = user?.passwordHash ?? (await dummyHash);
      const valid = await passwords.verify(password, hashToCheck);
      // One code and one message for every case, for the same reason: "no such user" would reveal the account list.
      if (!user?.passwordHash || !valid) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');

      // The password is known to be correct only here, so this is the only moment an old hash (e.g. a lower cost
      // from earlier years) can be replaced with a stronger one.
      if (passwords.needsRehash(user.passwordHash)) {
        const newHash = await passwords.hash(password);
        users.updatePasswordHash(user.id, newHash);
      }

      return startSession(user);
    },

    /** "Log in with GitHub": the same session as a password login, for the user linked to this provider account. */
    async loginWithOAuth(profile: OAuthProfile): Promise<AuthResult> {
      // Linked by the provider's user ID only, never by email: an attacker could have registered the victim's email
      // here with a password first, and would keep that password into the victim's account (pre-account hijacking).
      const linked = users.findByOAuthIdentity(profile.provider, profile.providerUserId);
      if (linked) return startSession(linked);

      // A GitHub name may be empty, too long, or full of invisible characters: then the email's local part is used
      // (cut to the same 100-character limit as every other name).
      const parsedName = userName.safeParse(profile.name);
      const atIndex = profile.email.indexOf('@');
      const emailLocalPart = profile.email.slice(0, atIndex);
      const name = parsedName.success ? parsedName.data : emailLocalPart.slice(0, 100);
      let user: User;
      try {
        // No password: this account can only log in through the provider (password login answers INVALID_CREDENTIALS).
        user = users.create({ name, email: profile.email, passwordHash: null, role: 'user' });
      } catch (error) {
        // The email belongs to another account here (password or another provider account). Not linked (see above):
        // that account keeps its own login method.
        if (error instanceof EmailTakenError) {
          throw new AppError(409, 'OAUTH_EMAIL_TAKEN', 'An account with this email already exists');
        }
        throw error;
      }
      // No `await` since findByOAuthIdentity, so two parallel callbacks cannot both create an account (in memory;
      // a real database needs one transaction and a unique index on provider + providerUserId).
      users.addOAuthIdentity(user.id, profile.provider, profile.providerUserId);
      return startSession(user);
    },

    /** Swaps a refresh token for a new access token AND a new refresh token (rotation). */
    async refresh(token: string | undefined): Promise<AuthResult> {
      if (!token) throw sessionEnded();
      let refreshToken: IssuedRefreshToken;
      try {
        refreshToken = await refreshTokens.rotate(token);
      } catch (error) {
        if (error instanceof RefreshTokenError) throw sessionEnded();
        throw error;
      }

      // The token is valid, but the account may be gone. Without this check, a deleted user's refresh token would
      // keep making access tokens for up to 30 days. The new refresh token was never sent anywhere, so nobody holds it.
      const user = users.findById(refreshToken.userId);
      if (!user) throw sessionEnded();
      return toAuthResult(user, refreshToken);
    },

    /**
     * Ends the session of this refresh token (its whole family). No token, or one that is already dead, is not an
     * error: the user wants to be logged out, and they are. The access token is not needed: it may have expired already.
     */
    async logout(token: string | undefined): Promise<void> {
      if (!token) return;
      await refreshTokens.revoke(token);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
