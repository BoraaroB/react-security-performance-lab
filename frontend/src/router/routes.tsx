import type { RouteObject } from 'react-router';
import { RootLayout } from '@/layouts/RootLayout';
import { HomePage } from '@/pages/HomePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { RouteErrorPage } from '@/pages/RouteErrorPage';
import { GuestRoute } from '@/router/GuestRoute';
import { AdminPage, ComponentsPage, DashboardPage, LoginPage, RegisterPage } from '@/router/lazy-pages';
import { PATHS } from '@/router/paths';
import { ProtectedRoute } from '@/router/ProtectedRoute';
import { RequireRole } from '@/router/RequireRole';

// Route config: plain objects, not JSON, so pages stay type-checked and can be lazy loaded.
// The layout, home and 404 pages are NOT lazy: nearly every visit needs them for the first screen.
// Access groups are pathless layout routes: the guard renders <Outlet /> (the page) or redirects.
export const routes: RouteObject[] = [
  {
    path: PATHS.home,
    element: <RootLayout />,
    // Only for errors in the layout itself: there is no header to keep, so it gets the page padding here.
    errorElement: (
      <main className="mx-auto max-w-2xl p-8">
        <RouteErrorPage />
      </main>
    ),
    children: [
      {
        // A route without a path: it adds no URL, only an error boundary around every page.
        // A page that throws (or whose code fails to download) is replaced inside the layout, so the header stays.
        errorElement: <RouteErrorPage />,
        children: [
          {
            index: true,
            element: <HomePage />,
          },
          {
            path: PATHS.components,
            element: <ComponentsPage />,
          },
          // Only for visitors who are not logged in.
          {
            element: <GuestRoute />,
            children: [
              {
                path: PATHS.login,
                element: <LoginPage />,
              },
              {
                path: PATHS.register,
                element: <RegisterPage />,
              },
            ],
          },
          // Only for logged-in users; the admin group is nested, so it gets the login check too.
          {
            element: <ProtectedRoute />,
            children: [
              {
                path: PATHS.dashboard,
                element: <DashboardPage />,
              },
              {
                element: <RequireRole allowedRoles={['admin']} />,
                children: [
                  {
                    path: PATHS.admin,
                    element: <AdminPage />,
                  },
                ],
              },
            ],
          },
          // Catch-all: any other URL renders inside the layout, so the navigation stays usable.
          {
            path: '*',
            element: <NotFoundPage />,
          },
        ],
      },
    ],
  },
];
