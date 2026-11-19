import { Card } from '@/components/ui';
import { useAuth } from '@/features/auth/auth.context';

// Behind ProtectedRoute. Step 22 adds the posts here.
export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
      <Card className="text-gray-700">
        {/* React escapes text in JSX, so the name is shown as text, never run as HTML. */}
        Logged in as {user?.name} ({user?.role}).
      </Card>
    </div>
  );
}
