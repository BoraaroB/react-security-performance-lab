import { AppError } from '../../lib/errors/index.js';
import { toPublicUser, type PublicUser, type Role, type UsersRepository } from '../repositories/users.repository.js';

export interface AdminDeps {
  users: Pick<UsersRepository, 'findAll' | 'findById' | 'updateRole'>;
}

export interface RoleChange {
  user: PublicUser;
  previousRole: Role;
}

/**
 * Business logic for admin pages. The admin router checks the role for every route (`requireAdmin` in `app.ts`),
 * so a new admin route cannot forget it.
 */
export function createAdminService({ users }: AdminDeps) {
  return {
    listUsers(): PublicUser[] {
      const allUsers = users.findAll();
      // The public shape even for admins: an admin page never needs password hashes.
      return allUsers.map(toPublicUser);
    },

    changeRole(currentAdmin: PublicUser, userId: string, role: Role): RoleChange {
      const user = users.findById(userId);
      if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');

      // No self-demotion: an admin cannot lock themselves out by mistake. Another admin has to do it.
      if (user.id === currentAdmin.id) {
        throw new AppError(409, 'CANNOT_CHANGE_OWN_ROLE', 'You cannot change your own role');
      }

      // Check the caller's role again, right before the write: `requireAdmin` ran earlier in this request, and another
      // admin may have demoted the caller in between. Because the caller is an admin now and is not the target, at
      // least one admin always remains (also when two admins demote each other at the same time).
      const caller = users.findById(currentAdmin.id);
      if (caller?.role !== 'admin') throw new AppError(403, 'FORBIDDEN', 'You do not have permission to do this');

      // Takes effect on the user's next request: the role is loaded from the store every time, never read from the token.
      users.updateRole(user.id, role);
      return { user: toPublicUser({ ...user, role }), previousRole: user.role };
    },
  };
}

export type AdminService = ReturnType<typeof createAdminService>;
