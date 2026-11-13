import { z } from 'zod';

// The mobile app sends its refresh token in the JSON body (it has no cookie jar the server should rely on).
// Only a sanity cap here: `lib/refresh-tokens` checks the exact format itself, and every bad token gets the same 401.
export const refreshTokenBodySchema = z.object({
  refreshToken: z.string().min(1).max(256),
});

export type RefreshTokenBody = z.output<typeof refreshTokenBodySchema>;
