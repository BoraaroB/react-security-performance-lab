import { Navigate, Outlet, useLocation } from 'react-router';
import { Spinner } from '@/components/ui';
import { useAuth } from '@/features/auth/auth.context';
import { PATHS } from '@/router/paths';

// Layout route for pages that need a logged-in user. Only for the UX: the API checks the token on every request.
export function ProtectedRoute() {
  const { user, isRestoring } = useAuth();
  const location = useLocation();

  // Until the session check ends, `user: null` does not mean "logged out" (a reload would always go to the login page).
  if (isRestoring) {
    return <Spinner label="Checking your session" className="text-blue-600" />;
  }

  if (user === null) {
    // Remember where the user wanted to go; GuestRoute sends them back there after login.
    const redirectTo = location.pathname + location.search + location.hash;
    const search = new URLSearchParams({ redirectTo });
    // `replace`: the Back button must not return to a page that only redirects again.
    return <Navigate to={{ pathname: PATHS.login, search: search.toString() }} replace />;
  }

  return <Outlet />;
}
