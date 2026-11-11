import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { createEncryptor, DecryptionError } from '../../lib/crypto/index.js';
import { authenticate, createAccessTokenService, InvalidTokenError } from '../../lib/jwt/index.js';
import { createPasswordHasher, PasswordTooLongError } from '../../lib/password/index.js';
import { rateLimit } from '../../lib/rate-limit/index.js';
import { validate } from '../../lib/validation/index.js';
import { logger } from '../logger.js';

export const demoRouter = Router();

// Demo of validation and mass-assignment protection: send extra fields (e.g. "role") and see them dropped in the echo.
const signupSchema = z.object({
  name: z.string().trim().min(1).max(50),
  email: z.email(),
  age: z.number().int().min(13).optional(),
});

demoRouter.post('/validation', validate({ body: signupSchema }), (req, res) => {
  res.json({ received: req.body });
});

// Query strings are always text: coerce "2" → 2 and fall back to defaults when missing.
const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  sort: z.enum(['newest', 'oldest']).default('newest'),
});

demoRouter.get('/validation', validate({ query: listSchema }), (req, res) => {
  res.json({ received: req.query });
});

// Demo of a strict per-route limit (login gets the same kind of limiter): the 6th request within a minute gets 429.
demoRouter.get('/rate-limit', rateLimit({ windowMs: 60_000, limit: 5, logger }), (_req, res) => {
  res.json({ message: 'Request allowed. See the RateLimit header for what is left.' });
});

// Demo of AES-256-GCM with a fixed text (never the caller's input: an "encrypt anything" endpoint would let anyone
// use the server's key). Shows: random IV → different output each time; a changed value or context → rejected.
// Its own throwaway key, never DATA_ENCRYPTION_KEY: a public route must not hand out ciphertexts that the real key
// accepts (someone able to write to the store could plant them as authentic data).
const demoEncryptor = createEncryptor({ key: randomBytes(32) });

demoRouter.get('/crypto', (_req, res) => {
  const tryDecrypt = (payload: string, context: string) => {
    try {
      return demoEncryptor.decrypt(payload, context);
    } catch (error) {
      if (error instanceof DecryptionError) return error.code;
      throw error;
    }
  };
  const plaintext = 'Jane Doe';
  const first = demoEncryptor.encrypt(plaintext, 'demo:user-1');
  const second = demoEncryptor.encrypt(plaintext, 'demo:user-1');
  // Change the FIRST character of the ciphertext part to simulate tampering. (Not the last one: in base64 its low
  // bits can be unused padding, so changing it may not change any byte.)
  const [version, iv, tag, data = ''] = first.split('.');
  const tampered = [version, iv, tag, (data.startsWith('A') ? 'B' : 'A') + data.slice(1)].join('.');
  res.json({
    plaintext,
    first,
    second,
    decrypted: tryDecrypt(first, 'demo:user-1'),
    tampered: tryDecrypt(tampered, 'demo:user-1'),
    wrongContext: tryDecrypt(first, 'demo:user-2'),
  });
});

// Demo of bcrypt with a FIXED password (never the caller's input). Hashing is slow on purpose (~1 s of CPU for this
// whole response), so this route has a strict limit: an open "hash anything" endpoint would be a free way to burn CPU.
const demoPasswords = createPasswordHasher(); // default cost 12

demoRouter.get('/password', rateLimit({ windowMs: 60_000, limit: 5, logger }), async (_req, res) => {
  const password = 'User1234!';
  const started = performance.now();
  const first = await demoPasswords.hash(password);
  const hashMs = Math.round(performance.now() - started);
  const second = await demoPasswords.hash(password); // new random salt → a different hash for the same password
  const olderHash = await createPasswordHasher({ cost: 10 }).hash(password);
  const tooLong = await demoPasswords.hash('a'.repeat(73)).catch((error: unknown) => {
    if (error instanceof PasswordTooLongError) return error.code;
    throw error;
  });
  res.json({
    password,
    first,
    second,
    // "$2b$12$" + 22 characters of salt + 31 characters of hash: everything verify() needs is in one string.
    parts: { algorithm: first.slice(1, 3), cost: Number(first.slice(4, 6)), salt: first.slice(7, 29), hash: first.slice(29) },
    hashMs,
    verifyCorrect: await demoPasswords.verify(password, first),
    verifyWrong: await demoPasswords.verify('User1234?', first),
    needsRehash: { cost12Hash: demoPasswords.needsRehash(first), cost10Hash: demoPasswords.needsRehash(olderHash) },
    tooLong,
  });
});

// Demo of JWT access tokens: GET /jwt returns a token and shows which forged tokens are rejected; GET /jwt/protected
// needs that token (`Authorization: Bearer <token>`). A 60-second lifetime, so you can watch it turn into TOKEN_EXPIRED.
// Its own random secret, never JWT_SECRET: a public route must not hand out tokens that the real API accepts.
const demoTokenOptions = { secret: randomBytes(32), issuer: 'demo-api', audience: 'demo-web', ttlSeconds: 60 };
const demoTokens = createAccessTokenService(demoTokenOptions);
const otherServiceTokens = createAccessTokenService({ ...demoTokenOptions, audience: 'another-service' });

demoRouter.get('/jwt', (_req, res) => {
  const tryVerify = (token: string) => {
    try {
      return demoTokens.verify(token);
    } catch (error) {
      if (error instanceof InvalidTokenError) return error.code;
      throw error;
    }
  };
  const toPart = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const fromPart = (part = '') => JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>;

  const token = demoTokens.sign({ sub: 'demo-user-id' });
  const [header, payload, signature] = token.split('.');
  res.json({
    token,
    // Anyone can read these two parts (base64url, not encrypted). Only the signature proves the server made them.
    header: fromPart(header),
    payload: fromPart(payload),
    verify: {
      valid: tryVerify(token),
      // `sub` changed to another user's ID (to act as that user), the old signature kept: it no longer matches.
      subChangedToOtherUser: tryVerify(`${header}.${toPart({ ...fromPart(payload), sub: 'admin-user-id' })}.${signature}`),
      // Header changed to "alg: none" (a classic attack). Rejected because only HS256 is accepted. (The old signature
      // is kept: with an empty one, the library would reject it as "signature required" before checking `alg`.)
      algNone: tryVerify(`${toPart({ alg: 'none', typ: 'JWT' })}.${payload}.${signature}`),
      // Same secret, but made for another audience.
      otherAudience: tryVerify(otherServiceTokens.sign({ sub: 'demo-user-id' })),
    },
  });
});

demoRouter.get('/jwt/protected', authenticate(demoTokens), (req, res) => {
  res.json({ auth: req.auth });
});
