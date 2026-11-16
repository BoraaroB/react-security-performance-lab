import { z } from 'zod';

// What the provider puts in the callback URL: `code` + `state` on success, `error` (+ `state`) when the user cancels.
// Everything is optional here, because the controller answers every failure with a redirect, not a 400. Short max
// lengths: anyone can open this URL with anything in it; real values are far shorter. A repeated parameter
// (`?code=a&code=b`) arrives as an array and fails.
export const oauthCallbackQuerySchema = z.object({
  code: z.string().min(1).max(512).optional(),
  state: z.string().max(128).optional(),
  error: z.string().max(128).optional(),
});
