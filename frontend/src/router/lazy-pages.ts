import { lazyWithPreload } from '@/lib/lazy-with-preload';

// Pages that are their own file in the build, downloaded on first visit (or earlier, by preload on link hover).
// Home and 404 are NOT here: the landing page and the fallback page belong in the first download.
// Kept apart from routes.tsx so the layout can import them for preloading without a circular import.
export const ComponentsPage = lazyWithPreload(() => import('@/pages/ComponentsPage'));
export const LoginPage = lazyWithPreload(() => import('@/pages/LoginPage'));
