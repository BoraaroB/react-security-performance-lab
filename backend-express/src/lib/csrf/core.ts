/**
 * Framework-free CSRF checks: a signed double-submit token and an `Origin` allowlist.
 *
 * CSRF: another site makes the victim's browser send a request to our API, and the browser attaches our cookies on
 * its own. The defenses here need things that site cannot do: read a token from our response (the same-origin policy
 * blocks it) and send it in a custom header, and fake the browser's `Origin` header.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export class CsrfConfigError extends Error {
  readonly code = 'INVALID_CSRF_CONFIG';
}

export interface CsrfTokenOptions {
  /** HMAC key, at least 32 characters. Its own secret: never reuse the JWT or encryption key. */
  secret: string;
}

export interface CsrfTokenService {
  /** A new token: `<random>.<signature>`. */
  create(): string;
  /** True only if both values are equal AND the signature is ours. Never throws; any non-string is false. */
  verify(cookieToken: unknown, headerToken: unknown): boolean;
}

// 32 random bytes and an HMAC-SHA256 are both 43 characters in base64url.
const TOKEN_FORMAT = /^[\w-]{43}\.[\w-]{43}$/;

// Compares in constant time, so the response time does not reveal how many leading characters were right.
function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
}

export function createCsrfTokenService({ secret }: CsrfTokenOptions): CsrfTokenService {
  if (secret.length < 32) throw new CsrfConfigError('CSRF secret must be at least 32 characters');

  const sign = (random: string) => createHmac('sha256', secret).update(random).digest('base64url');

  return {
    create() {
      const random = randomBytes(32).toString('base64url');
      return `${random}.${sign(random)}`;
    },
    verify(cookieToken, headerToken) {
      if (typeof cookieToken !== 'string' || typeof headerToken !== 'string') return false;
      if (!TOKEN_FORMAT.test(cookieToken)) return false;
      // Double submit: the cookie is sent by the browser on its own, the header only by our JavaScript.
      if (!safeEqual(cookieToken, headerToken)) return false;
      // Signed: rejects values the server did not create. Not bound to a session, so it does NOT stop planting a
      // pair the server issued (anyone can get one); the `__Host-` cookie prefix stops that.
      const [random = '', signature = ''] = cookieToken.split('.');
      return safeEqual(signature, sign(random));
    },
  };
}

/** GET, HEAD and OPTIONS must not change anything, so they need no CSRF check. Everything else does. */
export function isSafeMethod(method: string): boolean {
  return method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
}

/**
 * True only when the browser's `Origin` header is one of the exact allowed origins. A missing header and `null`
 * (sent e.g. from sandboxed iframes or after some redirects) are always rejected, even if the list contains "null":
 * on cookie routes only browsers are expected, and every current browser sends `Origin` on POST, PUT, PATCH and DELETE.
 */
export function isAllowedOrigin(origin: string | undefined, allowedOrigins: readonly string[]): boolean {
  if (origin === undefined || origin === 'null') return false;
  return allowedOrigins.includes(origin);
}
