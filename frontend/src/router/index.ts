import { createBrowserRouter } from 'react-router';
import { routes } from '@/router/routes';

// Created once at module level: creating it inside a component would rebuild the router on every render.
export const router = createBrowserRouter(routes);
