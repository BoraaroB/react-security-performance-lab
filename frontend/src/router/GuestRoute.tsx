import { Navigate, Outlet, useSearchParams } from 'react-router';
import { Spinner } from '@/components/ui';
import { useAuth } from '@/features/auth/auth.context';
import { PATHS } from '@/router/paths';

// Layout route for the login and register pages: a logged-in user is sent on, so a successful login
// needs no navigate() call in the form. The forms are never shown during the session check, so a login cannot race it.
export function GuestRoute() {
  const { user, isRestoring } = useAuth();
  const [searchParams] = useSearchParams();

  if (isRestoring) {
    return <Spinner label="Checking your session" className="text-blue-600" />;
  }

  if (user !== null) {
    const target = getSafeRedirectPath(searchParams.get('redirectTo'));
    return <Navigate to={target} replace />;
  }

  return <Outlet />;
}

// `redirectTo` comes from the URL, so anyone can put any value in a link they send to a victim. This check is what
// stops an open redirect (a logged-in user sent to a fake site). React Router 7.18+ also refuses an external
// <Navigate> (the user would see the error page); a redirect done with `window.location` would have no such safety net.
function getSafeRedirectPath(redirectTo: string | null): string {
  if (redirectTo === null) {
    return PATHS.dashboard;
  }
  let url: URL;
  try {
    // Resolving against our own origin is how the browser itself reads the value: "//evil.example",
    // "/\evil.example" and "javascript:..." all end up with a different origin.
    url = new URL(redirectTo, window.location.origin);
  } catch {
    return PATHS.dashboard;
  }
  // "/.//evil.example" keeps our origin but its path becomes "//evil.example", which is again a link to another site.
  if (url.origin !== window.location.origin || url.pathname.startsWith('//')) {
    return PATHS.dashboard;
  }
  return url.pathname + url.search + url.hash;
}
