import { z } from 'zod';

// Mirror the server's schemas (backend-express/src/app/schemas/auth.schemas.ts). The browser check only gives
// quick feedback: anyone can skip it (curl, DevTools), so the server validates everything again.

// 254 = the longest email address that can actually be delivered (RFC 5321).
const email = z.string().trim().pipe(z.email('Enter a valid email address').max(254));

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Same limits as the server's registerSchema (NIST SP 800-63B-4: length over "one digit and one symbol" rules).
export const MIN_PASSWORD_CHARACTERS = 15;
// bcrypt ignores everything after 72 BYTES; a Cyrillic letter takes 2 bytes, an emoji 4.
const MAX_PASSWORD_BYTES = 72;
// No control or invisible characters (zero-width space, right-to-left override): they can fake another user's name.
const NO_CONTROL_CHARACTERS = /^[^\p{Cc}\p{Cf}]+$/u;

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter your name')
    .max(100, 'At most 100 characters')
    .regex(NO_CONTROL_CHARACTERS, 'Must not contain control or invisible characters'),
  email,
  password: z
    .string()
    // Counted as Unicode code points: `.length` counts an emoji as 2.
    .refine((value) => [...value].length >= MIN_PASSWORD_CHARACTERS, {
      message: `At least ${MIN_PASSWORD_CHARACTERS} characters`,
    })
    .refine((value) => new TextEncoder().encode(value).length <= MAX_PASSWORD_BYTES, {
      message: `Too long: at most ${MAX_PASSWORD_BYTES} bytes (fewer characters for non-Latin letters or emoji)`,
    }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
