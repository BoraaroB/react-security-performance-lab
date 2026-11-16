import type { RequestHandler } from 'express';
import { getCurrentUser } from '../middleware/current-user.middleware.js';
import type { ChangeRoleInput, UserIdParams } from '../schemas/admin.schemas.js';
import type { AdminService } from '../services/admin.service.js';

export function createAdminController(admin: AdminService) {
  const listUsers: RequestHandler = (_req, res) => {
    const users = admin.listUsers();
    res.json({ users });
  };

  const changeRole: RequestHandler<UserIdParams, unknown, ChangeRoleInput> = (req, res) => {
    const currentAdmin = getCurrentUser(req);
    const { user, previousRole } = admin.changeRole(currentAdmin, req.params.id, req.body.role);
    // A role change is a security event: operators must be able to find who gave whom which role. IDs only.
    // `from` and `to` show a promotion, a demotion, or a no-op (both the same).
    req.log.info({ adminId: currentAdmin.id, userId: user.id, from: previousRole, to: user.role }, 'User role changed');
    res.json({ user });
  };

  return { listUsers, changeRole };
}
