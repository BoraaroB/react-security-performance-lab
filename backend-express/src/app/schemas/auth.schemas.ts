import { z } from 'zod';
import { MAX_PASSWORD_BYTES } from '../../lib/password/index.js';

// What a request body must look like. Unknown fields are stripped (z.object), so nothing extra reaches the service.
export const loginSchema = z.object({
  // 254 = the longest email address that can actually be delivered (RFC 5321).
  email: z.string().trim().pipe(z.email().max(254)),
  // A password longer than 72 characters is also longer than 72 bytes, so it can never match a bcrypt hash.
  // Rejecting it here also caps how much text bcrypt is ever asked to read.
  password: z.string().min(1).max(MAX_PASSWORD_BYTES),
});

export type LoginInput = z.output<typeof loginSchema>;
