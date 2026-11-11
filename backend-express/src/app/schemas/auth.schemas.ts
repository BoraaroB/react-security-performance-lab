import { z } from 'zod';
import { MAX_PASSWORD_BYTES } from '../../lib/password/index.js';

// 254 = the longest email address that can actually be delivered (RFC 5321).
const email = z.string().trim().pipe(z.email().max(254));

// What a request body must look like. Unknown fields are stripped (z.object), so nothing extra reaches the service.
export const loginSchema = z.object({
  email,
  // A password longer than 72 characters is also longer than 72 bytes, so it can never match a bcrypt hash.
  // Rejecting it here also caps how much text bcrypt is ever asked to read.
  password: z.string().min(1).max(MAX_PASSWORD_BYTES),
});

export type LoginInput = z.output<typeof loginSchema>;

const MIN_PASSWORD_CHARACTERS = 15;

// No `role` field: a new account is always a plain user. A `"role": "admin"` in the body is stripped here, and the
// service sets the role itself (mass-assignment protection).
export const registerSchema = z.object({
  // No control or invisible characters (zero-width space, right-to-left override, ...): they can make a name look
  // empty or look like someone else's. `trim()` does not remove them. React escapes HTML, so this is about spoofing.
  name: z
    .string()
    .trim()
    .normalize('NFC')
    .min(1)
    .max(100)
    .regex(/^[^\p{Cc}\p{Cf}]+$/u, 'Must not contain control or invisible characters'),
  email,
  // NIST SP 800-63B-4 (2025): at least 15 characters when the password is the only factor (as here), and no forced
  // rules like "one digit and one symbol" (they lead to "Password1!"): length matters more. Characters are counted as
  // Unicode code points (`[...value]`), not with `.length`, where an emoji counts as 2. The upper limit is in BYTES:
  // bcrypt ignores everything after 72 bytes, and a Cyrillic letter takes 2 bytes, an emoji 4.
  password: z
    .string()
    .refine((value) => [...value].length >= MIN_PASSWORD_CHARACTERS, {
      message: `Too short: at least ${MIN_PASSWORD_CHARACTERS} characters`,
    })
    .refine((value) => Buffer.byteLength(value, 'utf8') <= MAX_PASSWORD_BYTES, {
      message: `Too long: at most ${MAX_PASSWORD_BYTES} bytes (fewer characters for non-Latin letters or emoji)`,
    }),
});

export type RegisterInput = z.output<typeof registerSchema>;
