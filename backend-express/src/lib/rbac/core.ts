/**
 * Framework-free role check, so an Express middleware and a Nest guard make the same decision.
 */

/** A setup mistake (e.g. `authorize()` with no roles). Thrown at startup, never for a request. */
export class RbacConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RbacConfigError';
  }
}

/**
 * True only if the user has one of the allowed roles. Deny by default: no role, or an empty list, is never allowed.
 * Exact string match: no role hierarchy, so `admin` is not "more than" `user` unless a route lists both.
 */
export function hasRole<Role extends string>(role: Role | undefined, allowedRoles: readonly Role[]): boolean {
  if (role === undefined) return false;
  return allowedRoles.includes(role);
}
