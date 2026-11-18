import { createBrowserRouter } from 'react-router';
import { RootLayout } from '@/app/RootLayout';
import { ComponentsPage } from '@/pages/ComponentsPage';
import { HomePage } from '@/pages/HomePage';
import { NotFoundPage } from '@/pages/NotFoundPage';

// Created once at module level: creating it inside a component would rebuild the router on every render.
export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'components',
        element: <ComponentsPage />,
      },
      // Catch-all: any other URL renders inside the layout, so the navigation stays usable.
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
]);
