import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { Toaster } from 'sonner';
import { router } from '@/router';
import '@/index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Element #root not found in index.html');
}

// One place for every render error (React 19). These replace React's default handling (console logging, and for
// uncaught errors also the window 'error' event that error trackers listen to). A real app would send them to an
// error-tracking service (e.g. Sentry) here, never to the user's screen.
const root = createRoot(rootElement, {
  // An error boundary (ours or the router's errorElement) caught it and shows a fallback.
  onCaughtError: (error, errorInfo) => {
    console.error('Render error (caught by a boundary):', error, errorInfo.componentStack);
  },
  // No boundary caught it: React removed the whole app from the page.
  onUncaughtError: (error, errorInfo) => {
    console.error('Render error (uncaught, app unmounted):', error, errorInfo.componentStack);
  },
});
// StrictMode runs effects twice in development, so a missing cleanup (a memory leak) shows up early.
root.render(
  <StrictMode>
    <RouterProvider router={router} />
    {/* Toast notifications (sonner): call `toast(...)` from anywhere; no provider needed. */}
    <Toaster richColors closeButton />
  </StrictMode>,
);
