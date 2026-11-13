import { toPublicUser, type PublicUser, type UsersRepository } from '../repositories/users.repository.js';

export interface AdminDeps {
  users: Pick<UsersRepository, 'findAll'>;
}

/**
 * Business logic for admin pages. It does not check the role itself: the admin router does that for every route
 * (`authorize('admin')`), so a new admin route cannot forget it.
 */
export function createAdminService({ users }: AdminDeps) {
  return {
    listUsers(): PublicUser[] {
      const allUsers = users.findAll();
      // The public shape even for admins: an admin page never needs password hashes.
      return allUsers.map(toPublicUser);
    },
  };
}

export type AdminService = ReturnType<typeof createAdminService>;
