import type { RequestHandler } from 'express';
import type { AdminService } from '../services/admin.service.js';

export function createAdminController(admin: AdminService) {
  const listUsers: RequestHandler = (_req, res) => {
    const users = admin.listUsers();
    res.json({ users });
  };

  return { listUsers };
}
