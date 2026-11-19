import { useState, type ChangeEvent } from 'react';
import { toast } from 'sonner';
import { Card, Select, Spinner } from '@/components/ui';
import { useAuth } from '@/features/auth/auth.context';
import { ApiError } from '@/lib/http';
import { changeRole, type AdminUser, type Role } from './admin.api';

// Text by error code, never the server's message. A Map, so a code like "__proto__" finds nothing.
const ROLE_ERROR_MESSAGES = new Map([
  ['CANNOT_CHANGE_OWN_ROLE', 'You cannot change your own role. Ask another admin.'],
  ['FORBIDDEN', 'You are no longer an admin. Reload the page.'],
  ['NOT_FOUND', 'This user no longer exists. Reload the page.'],
]);

type UserTableProps = {
  // The list from the first GET; changes are kept in local state (like PostFeed).
  initialUsers: AdminUser[];
};

export function UserTable({ initialUsers }: UserTableProps) {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState(initialUsers);
  // One change at a time in the whole table: with one id per row, a second save would clear the first one's lock,
  // and two answers for the same row could arrive out of order.
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  async function handleRoleChange(userId: string, event: ChangeEvent<HTMLSelectElement>) {
    // The value comes from our own <option>s, but anyone can edit the DOM: the server validates it again (z.enum).
    const role = event.target.value as Role;
    setSavingUserId(userId);
    try {
      const updatedUser = await changeRole(userId, role);
      setUsers((current) => current.map((user) => (user.id === updatedUser.id ? updatedUser : user)));
      const roleText = updatedUser.role === 'admin' ? 'an admin' : 'a user';
      toast.success(`${updatedUser.name} is now ${roleText}`);
    } catch (error) {
      let message = 'Could not change the role. Please try again.';
      if (error instanceof ApiError) {
        message = ROLE_ERROR_MESSAGES.get(error.code) ?? message;
      }
      toast.error(message);
    } finally {
      setSavingUserId(null);
    }
  }

  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-left text-sm">
        {/* A name for screen readers that list the tables on a page. */}
        <caption className="sr-only">Users</caption>
        <thead className="border-b border-gray-200 text-gray-500">
          <tr>
            <th className="p-3 font-medium">Name</th>
            <th className="p-3 font-medium">Email</th>
            <th className="p-3 font-medium">Role</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const isCurrentUser = user.id === currentUser?.id;
            const isSaving = user.id === savingUserId;
            return (
              <tr key={user.id} className="border-b border-gray-100 last:border-0">
                <td className="p-3 text-gray-900">
                  {user.name}
                  {isCurrentUser && <span className="text-gray-500"> (you)</span>}
                </td>
                <td className="p-3 break-all text-gray-700">{user.email}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {/* Own row disabled: the API refuses it anyway (CANNOT_CHANGE_OWN_ROLE), so no admin locks themselves out.
                        Controlled by `user.role`: it shows the old role until the server confirms the new one. */}
                    <Select
                      aria-label={`Role of ${user.name}`}
                      value={user.role}
                      disabled={isCurrentUser || savingUserId !== null}
                      onChange={(event) => handleRoleChange(user.id, event)}
                      className="w-28"
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </Select>
                    {isSaving && <Spinner label="Saving" className="text-blue-600" />}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
