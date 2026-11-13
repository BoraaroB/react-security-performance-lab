// Role-based access control (RBAC): lets a request through only when the current user has an allowed role, so a
// normal user cannot call admin routes even if they know the URL (the frontend hiding a button protects nothing).
export { hasRole, RbacConfigError } from './core.js';
export { createAuthorize, type AuthorizeOptions } from './express.js';
