import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router';
import { Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';
import { ComponentsPage, HomePage } from '@/router/pages';
import { PATHS } from '@/router/paths';

const NAV_LINKS = [
  { to: PATHS.home, label: 'Home', page: HomePage },
  { to: PATHS.components, label: 'Components', page: ComponentsPage },
] as const;

// Shared frame for every page: the header stays mounted while <Outlet /> swaps the page below it.
export function RootLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <nav aria-label="Main" className="mx-auto flex max-w-2xl gap-4 px-8 py-3">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              // Without `end`, "/" would match every URL and Home would always look active.
              end
              // Start downloading the page's code before the click (hover comes a moment before it; focus for keyboard users).
              onMouseEnter={link.page.preload}
              onFocus={link.page.preload}
              // NavLink also sets aria-current="page" on the active link for screen readers.
              className={({ isActive }) =>
                cn('text-sm font-medium', isActive ? 'text-blue-700' : 'text-gray-600 hover:text-gray-900')
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
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
