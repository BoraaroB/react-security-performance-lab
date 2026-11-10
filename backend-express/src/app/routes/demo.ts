import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../lib/validation/index.js';

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
