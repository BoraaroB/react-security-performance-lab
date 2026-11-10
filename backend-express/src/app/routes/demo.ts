import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { createEncryptor, DecryptionError } from '../../lib/crypto/index.js';
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
