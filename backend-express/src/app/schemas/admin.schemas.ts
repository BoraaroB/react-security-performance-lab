import { z } from 'zod';

// User IDs are random UUIDs (users.repository.ts), so anything else is rejected before the lookup.
export const userIdParamsSchema = z.object({
  id: z.uuid(),
});

export type UserIdParams = z.output<typeof userIdParamsSchema>;

// Only `role`, and only a known one. Any other field (`email`, `passwordHash`, ...) is stripped (mass assignment).
// The roles must match `UserRecord['role']` in store.ts.
export const changeRoleSchema = z.object({
  role: z.enum(['user', 'admin']),
});

export type ChangeRoleInput = z.output<typeof changeRoleSchema>;
