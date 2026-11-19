import { Outlet } from 'react-router';
import type { AuthUser } from '@/features/auth/auth.api';
import { useAuth } from '@/features/auth/auth.context';

type RequireRoleProps = {
  allowedRoles: AuthUser['role'][];
};

// Nested inside ProtectedRoute, so the session check is done and `user` is set here.
// Only hides pages: the page's code can still be downloaded, and the API checks the role on every admin request.
export function RequireRole({ allowedRoles }: RequireRoleProps) {
  const { user } = useAuth();

  // Fails closed: used outside ProtectedRoute by mistake (`user` is null), it shows the message, not the page.
  if (user === null || !allowedRoles.includes(user.role)) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">No access</h1>
        <p className="text-gray-700">You do not have permission to view this page.</p>
      </div>
    );
  }

  return <Outlet />;
}
