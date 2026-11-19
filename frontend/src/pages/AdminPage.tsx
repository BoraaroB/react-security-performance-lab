import { Card } from '@/components/ui';

// Behind ProtectedRoute + RequireRole(admin). Step 22 adds user role management here.
export default function AdminPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Admin</h1>
      <Card className="text-gray-700">
        Only admins see this page. The API still checks the role on every admin request.
      </Card>
    </div>
  );
}
