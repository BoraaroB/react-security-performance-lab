import { Router } from 'express';
import { z } from 'zod';
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
