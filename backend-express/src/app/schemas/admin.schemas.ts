import { z } from 'zod';
import { ROLES } from '../store.js';

// User IDs are random UUIDs (users.repository.ts), so anything else is rejected before the lookup.
export const userIdParamsSchema = z.object({
  id: z.uuid(),
});

export type UserIdParams = z.output<typeof userIdParamsSchema>;

// Only `role`, and only a known one. Any other field (`email`, `passwordHash`, ...) is stripped (mass assignment).
export const changeRoleSchema = z.object({
  role: z.enum(ROLES),
});

export type ChangeRoleInput = z.output<typeof changeRoleSchema>;
