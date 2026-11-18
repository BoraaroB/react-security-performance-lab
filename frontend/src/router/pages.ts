import { lazyWithPreload } from '@/lib/lazy-with-preload';

// Every page is its own file in the build, downloaded on first visit (or earlier, by preload on link hover).
// Kept apart from routes.tsx so the layout can import them for preloading without a circular import.
export const HomePage = lazyWithPreload(() => import('@/pages/HomePage'));
export const ComponentsPage = lazyWithPreload(() => import('@/pages/ComponentsPage'));
export const NotFoundPage = lazyWithPreload(() => import('@/pages/NotFoundPage'));
