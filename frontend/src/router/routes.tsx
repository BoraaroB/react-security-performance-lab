import type { RouteObject } from 'react-router';
import { RootLayout } from '@/layouts/RootLayout';
import { HomePage } from '@/pages/HomePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { RouteErrorPage } from '@/pages/RouteErrorPage';
import { ComponentsPage, LoginPage } from '@/router/lazy-pages';
import { PATHS } from '@/router/paths';

// Route config: plain objects, not JSON, so pages stay type-checked and can be lazy loaded.
// The layout, home and 404 pages are NOT lazy: nearly every visit needs them for the first screen.
// Public pages only for now; step 21 adds the ProtectedRoute / GuestRoute / RequireRole groups.
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
          {
            path: PATHS.login,
            element: <LoginPage />,
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
