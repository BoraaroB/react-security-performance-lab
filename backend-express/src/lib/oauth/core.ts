/**
 * Framework-free OAuth 2.0 client: Authorization Code flow with PKCE (RFC 7636) and `state`.
 *
 * `state` stops login CSRF: an attacker cannot make the victim's browser finish a login the victim never started.
 * PKCE stops code injection: a stolen `code` works only with the verifier of the login that requested it, so an
 * attacker who pastes it into our callback from their own browser (with their own verifier) gets nothing.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

const DEFAULT_TIMEOUT_MS = 10_000;
// 32 random bytes in base64url are always 43 characters (also the shortest verifier RFC 7636 allows).
const RANDOM_VALUE_FORMAT = /^[\w-]{43}$/;

/** Thrown at startup for bad options. */
export class OAuthConfigError extends Error {
  readonly code = 'INVALID_OAUTH_CONFIG';
}

/**
 * The code exchange failed. `providerError` is the provider's error code (e.g. GitHub's `bad_verification_code`) and
 * `cause` the network error (timeout, DNS, TLS, redirect): both for the server log, never for the user.
 */
export class OAuthError extends Error {
  readonly code = 'OAUTH_FAILED';
  readonly providerError?: string;
  constructor(message: string, options: { providerError?: string; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.providerError = options.providerError;
  }
}

export interface OAuthClientOptions {
  /** The provider's login page, e.g. `https://github.com/login/oauth/authorize`. */
  authorizeUrl: string;
  /** The provider's token endpoint. The client secret is sent here, so it must be https. */
  tokenUrl: string;
  clientId: string;
  /** Sent only to `tokenUrl`, server to server. Never to the browser. */
  clientSecret: string;
  /** Our callback URL, exactly as registered at the provider. */
  redirectUri: string;
  /** Ask for as little as possible. Default: none (the provider's minimum). */
  scopes?: string[];
  /** How long to wait for the token endpoint. Default 10 s. */
  timeoutMs?: number;
}

export interface AuthorizationRequest {
  /** Redirect the browser here. */
  url: string;
  /** Keep it on the server side (e.g. an httpOnly cookie) and compare it in the callback with `isSameState`. */
  state: string;
  /** Keep it secret until the callback. Only its hash (the challenge) is in `url`. */
  codeVerifier: string;
}

export interface OAuthTokens {
  /** The provider's token, to call its API (e.g. GitHub's `/user`). Not our session: never send it to the browser. */
  accessToken: string;
  /** The scopes the user actually granted (may be fewer than asked for). */
  scope: string;
}

/** Who logged in, read from the provider's API with its access token (e.g. `fetchGithubProfile`). */
export interface OAuthProfile {
  provider: string;
  /** The provider's stable user ID. Link accounts by `provider` + this, never by email or username (both can change). */
  providerUserId: string;
  /** Primary and verified at the provider. */
  email: string;
  name: string;
}

export interface OAuthClient {
  createAuthorizationRequest(): AuthorizationRequest;
  /** Trades the `code` from the callback for the provider's access token. Throws `OAuthError`. */
  exchangeCode(code: string, codeVerifier: string): Promise<OAuthTokens>;
}

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string(),
  scope: z.string().default(''),
});
// Some providers (GitHub) answer an error with status 200, so the body is checked for `error` first.
const errorResponseSchema = z.object({ error: z.string() });

export function createOAuthClient(options: OAuthClientOptions): OAuthClient {
  const { authorizeUrl, tokenUrl, clientId, clientSecret, redirectUri, scopes = [], timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  for (const value of [authorizeUrl, tokenUrl, redirectUri]) {
    // https only, except localhost (traffic that never leaves the machine).
    const url = URL.parse(value);
    const isLocalhost = url?.protocol === 'http:' && url.hostname === 'localhost';
    if (url?.protocol !== 'https:' && !isLocalhost) {
      throw new OAuthConfigError(`OAuth URL must be https (or http://localhost): ${value}`);
    }
  }
  if (!clientId || !clientSecret) throw new OAuthConfigError('OAuth clientId and clientSecret are required');
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) throw new OAuthConfigError('OAuth timeoutMs must be a positive integer');

  return {
    createAuthorizationRequest() {
      const state = randomBytes(32).toString('base64url');
      const codeVerifier = randomBytes(32).toString('base64url');
      // S256: the provider gets only the hash now; the verifier itself comes later, server to server.
      const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

      const url = new URL(authorizeUrl);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('client_id', clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      if (scopes.length > 0) url.searchParams.set('scope', scopes.join(' '));
      url.searchParams.set('state', state);
      url.searchParams.set('code_challenge', codeChallenge);
      url.searchParams.set('code_challenge_method', 'S256');

      return {
        url: url.toString(),
        state,
        codeVerifier,
      };
    },

    async exchangeCode(code, codeVerifier) {
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
        code_verifier: codeVerifier,
      });

      let response: Response;
      try {
        response = await fetch(tokenUrl, {
          method: 'POST',
          // Without `Accept: application/json`, GitHub answers form-encoded.
          headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
          // The secret must go only to `tokenUrl`, never be re-sent to wherever a redirect points.
          redirect: 'error',
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        throw new OAuthError('Token endpoint could not be reached', { cause: error });
      }

      const data: unknown = await response.json().catch(() => null);
      const errorResult = errorResponseSchema.safeParse(data);
      if (errorResult.success) throw new OAuthError('Provider rejected the code', { providerError: errorResult.data.error });
      const tokenResult = tokenResponseSchema.safeParse(data);
      if (!response.ok || !tokenResult.success) throw new OAuthError(`Unexpected token response (HTTP ${response.status})`);
      if (tokenResult.data.token_type.toLowerCase() !== 'bearer') throw new OAuthError('Unexpected token type');

      return {
        accessToken: tokenResult.data.access_token,
        scope: tokenResult.data.scope,
      };
    },
  };
}

/**
 * True only if `received` (from the callback URL) equals `expected` (saved when the login started). Never throws;
 * a missing or malformed value is false. Constant-time compare, like every secret comparison.
 */
export function isSameState(expected: unknown, received: unknown): boolean {
  if (typeof expected !== 'string' || typeof received !== 'string') return false;
  if (!RANDOM_VALUE_FORMAT.test(expected)) return false;
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}
