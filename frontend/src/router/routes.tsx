import type { RouteObject } from 'react-router';
import { RootLayout } from '@/layouts/RootLayout';
import { ComponentsPage, HomePage, NotFoundPage } from '@/router/pages';
import { PATHS } from '@/router/paths';

// Route config: plain objects, not JSON, so pages stay type-checked and can be lazy loaded.
// The layout is NOT lazy: it is on every page, so it belongs in the first download.
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
