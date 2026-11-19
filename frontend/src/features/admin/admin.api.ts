import type { AuthUser } from '@/features/auth/auth.api';
import { authHttp } from '@/features/auth/auth.http';

// The API's PublicUser has the same fields as the logged-in user (id, email, name, role); never a password hash.
export type AdminUser = AuthUser;
export type Role = AdminUser['role'];

export type AdminUsersResponse = {
  users: AdminUser[];
};

export const ADMIN_USERS_PATH = '/api/admin/users';

// Only admins get an answer: the API checks the role on every /api/admin request, not this page.
export async function changeRole(userId: string, role: Role): Promise<AdminUser> {
  const path = `${ADMIN_USERS_PATH}/${encodeURIComponent(userId)}/role`;
  const response = await authHttp.request<{ user: AdminUser }>(path, { method: 'PATCH', body: { role } });
  return response.user;
}
