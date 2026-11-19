import { ErrorState } from '@/components/feedback/ErrorState';
import { Spinner } from '@/components/ui';
import { ADMIN_USERS_PATH, type AdminUsersResponse } from '@/features/admin/admin.api';
import { UserTable } from '@/features/admin/UserTable';
import { authHttp } from '@/features/auth/auth.http';
import { useFetch } from '@/hooks/useFetch';

// Behind ProtectedRoute + RequireRole(admin). That only hides the page: the API answers 403 to non-admins.
export default function AdminPage() {
  const { data, error, isLoading, reload } = useFetch<AdminUsersResponse>(authHttp, ADMIN_USERS_PATH);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Admin</h1>
      {isLoading && <Spinner label="Loading users" className="text-blue-600" />}
      {error !== undefined && <ErrorState error={error} onRetry={reload} title="Could not load the users" />}
      {data && <UserTable initialUsers={data.users} />}
    </div>
  );
}
