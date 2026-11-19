import { z } from 'zod';

// Mirrors the server's loginSchema (backend-express/src/app/schemas/auth.schemas.ts). The browser check only gives
// quick feedback: anyone can skip it (curl, DevTools), so the server validates everything again.
export const loginSchema = z.object({
  email: z.string().trim().pipe(z.email('Enter a valid email address').max(254)),
  password: z.string().min(1, 'Enter your password'),
});

export type LoginInput = z.infer<typeof loginSchema>;
