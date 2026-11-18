import type { RouteObject } from 'react-router';
import { RootLayout } from '@/layouts/RootLayout';
import { HomePage } from '@/pages/HomePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ComponentsPage } from '@/router/lazy-pages';
import { PATHS } from '@/router/paths';

// Route config: plain objects, not JSON, so pages stay type-checked and can be lazy loaded.
// The layout, home and 404 pages are NOT lazy: nearly every visit needs them for the first screen.
// Public pages only for now; step 21 adds the ProtectedRoute / GuestRoute / RequireRole groups.
export const routes: RouteObject[] = [
  {
    path: PATHS.home,
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: PATHS.components,
        element: <ComponentsPage />,
      },
      // Catch-all: any other URL renders inside the layout, so the navigation stays usable.
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
];
