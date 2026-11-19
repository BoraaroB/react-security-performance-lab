import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router';
import { Spinner } from '@/components/ui';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { cn } from '@/lib/cn';
import { ComponentsPage, LoginPage, RegisterPage } from '@/router/lazy-pages';
import { PATHS } from '@/router/paths';

// `preload` only for lazy pages; Home is already in the first download.
const NAV_LINKS: { to: string; label: string; preload?: () => void }[] = [
  { to: PATHS.home, label: 'Home' },
  { to: PATHS.components, label: 'Components', preload: ComponentsPage.preload },
  { to: PATHS.login, label: 'Log in', preload: LoginPage.preload },
  { to: PATHS.register, label: 'Register', preload: RegisterPage.preload },
];

// Shared frame for every page: the header stays mounted while <Outlet /> swaps the page below it.
export function RootLayout() {
  const isOnline = useOnlineStatus();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* `sticky` (not `fixed`): it stays in the page flow, so the content below needs no top padding.
          See `scroll-padding-top` in index.css, so the header never covers a focused element.
          See-through + blur shows the page scrolling under it. Browsers without backdrop-filter get an almost solid
          background instead, so the links stay readable over the page text. */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/70">
        <nav aria-label="Main" className="mx-auto flex max-w-2xl gap-4 px-8 py-3">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              // Without `end`, "/" would match every URL and Home would always look active.
              end
              // Start downloading the page's code before the click (hover comes a moment before it; focus for keyboard users).
              onMouseEnter={link.preload}
              onFocus={link.preload}
              // NavLink also sets aria-current="page" on the active link for screen readers.
              className={({ isActive }) =>
                cn('text-sm font-medium', isActive ? 'text-blue-700' : 'text-gray-600 hover:text-gray-900')
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        {/* A live region is only announced reliably if it is already on the page when its text changes,
            so this wrapper always stays mounted and only the message inside comes and goes. */}
        <div role="status">
          {!isOnline && (
            <p className="border-t border-amber-200 bg-amber-50 px-8 py-2 text-center text-sm text-amber-900">
              You are offline. Some features may not work until the connection is back.
            </p>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-2xl p-8">
        {/* Shown while a page's code downloads. Inside <main>, so the header stays visible. */}
        <Suspense fallback={<Spinner label="Loading page" className="text-blue-600" />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
