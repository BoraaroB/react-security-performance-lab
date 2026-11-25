import { Suspense, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { toast } from 'sonner';
import { Button, Spinner } from '@/components/ui';
import { useAuth } from '@/features/auth/auth.context';
import { useEventListener } from '@/hooks/useEventListener';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { cn } from '@/lib/cn';
import {
  AdminPage,
  ComponentsPage,
  DashboardPage,
  LoginPage,
  PerformancePage,
  RegisterPage,
  SecurityPage,
} from '@/router/lazy-pages';
import { PATHS } from '@/router/paths';

type NavLinkItem = { to: string; label: string; preload?: () => void };

// `preload` only for lazy pages; Home is already in the first download.
const NAV_LINKS: NavLinkItem[] = [
  { to: PATHS.home, label: 'Home' },
  { to: PATHS.components, label: 'Components', preload: ComponentsPage.preload },
  { to: PATHS.security, label: 'Security', preload: SecurityPage.preload },
  { to: PATHS.performance, label: 'Performance', preload: PerformancePage.preload },
];

// Only for visitors who are not logged in.
const GUEST_LINKS: NavLinkItem[] = [
  { to: PATHS.login, label: 'Log in', preload: LoginPage.preload },
  { to: PATHS.register, label: 'Register', preload: RegisterPage.preload },
];

const USER_LINKS: NavLinkItem[] = [{ to: PATHS.dashboard, label: 'Dashboard', preload: DashboardPage.preload }];

// Hiding the link is only for the UX: RequireRole guards the page and the API guards the data.
const ADMIN_LINKS: NavLinkItem[] = [{ to: PATHS.admin, label: 'Admin', preload: AdminPage.preload }];

// Shared frame for every page: the header stays mounted while <Outlet /> swaps the page below it.
export function RootLayout() {
  const isOnline = useOnlineStatus();
  const { user, isRestoring, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  // Only used below the `md` breakpoint; from `md` up the links are always visible.
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Escape is the expected keyboard way out of an open menu. If focus is on a menu link, it goes back to the button:
  // the link is about to be hidden, and focus on a hidden element falls back to <body>, so keyboard and screen-reader
  // users lose their place. Focus elsewhere (e.g. a form field on the page) stays where it is.
  useEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !isMenuOpen) return;
    setIsMenuOpen(false);
    if (menuRef.current?.contains(document.activeElement)) menuButtonRef.current?.focus();
  });

  let links = NAV_LINKS;
  if (user !== null) {
    links = [...NAV_LINKS, ...USER_LINKS];
  } else if (!isRestoring) {
    // Guest links wait for the session check, so a logged-in user does not see "Log in" flash on every page load.
    links = [...NAV_LINKS, ...GUEST_LINKS];
  }
  if (user?.role === 'admin') {
    links = [...links, ...ADMIN_LINKS];
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
      toast.success('Logged out');
    } catch {
      toast.error('Could not log out. Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* `sticky` (not `fixed`): it stays in the page flow, so the content below needs no top padding.
          See `scroll-padding-top` in index.css, so the header never covers a focused element.
          See-through + blur shows the page scrolling under it. Browsers without backdrop-filter get an almost solid
          background instead, so the links stay readable over the page text. */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/70">
        {/* Wider than <main> (max-w-2xl): an admin's six links, name and "Log out" do not fit in one row there. */}
        <nav aria-label="Main" className="mx-auto max-w-4xl px-4 py-3 sm:px-8">
          {/* Phones: the links do not fit in one row, so they fold into a list behind this button.
              `aria-expanded` tells screen readers whether the list is open; `aria-controls` names the list. */}
          <Button
            ref={menuButtonRef}
            variant="ghost"
            size="sm"
            aria-expanded={isMenuOpen}
            aria-controls="main-menu"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            Menu
          </Button>
          {/* One list for every screen size, only the CSS changes: a column under the button on phones (hidden while
              closed), one row from `md` up. `hidden` is display: none, so closed links are skipped by Tab and screen readers. */}
          <div
            ref={menuRef}
            id="main-menu"
            className={cn(
              'mt-2 flex-col gap-1 md:mt-0 md:flex md:flex-row md:items-center md:gap-4',
              isMenuOpen ? 'flex' : 'hidden',
            )}
          >
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                // Without `end`, "/" would match every URL and Home would always look active.
                end
                // Start downloading the page's code before the click (hover comes a moment before it; focus for keyboard users).
                onMouseEnter={link.preload}
                onFocus={link.preload}
                // The phone menu closes once a page is picked; on wider screens it is not used.
                onClick={() => setIsMenuOpen(false)}
                // NavLink also sets aria-current="page" on the active link for screen readers.
                // Taller rows on phones: an easier target for a finger.
                className={({ isActive }) =>
                  cn('py-2 text-sm font-medium md:py-0', isActive ? 'text-blue-700' : 'text-gray-600 hover:text-gray-900')
                }
              >
                {link.label}
              </NavLink>
            ))}
            {user && (
              <div className="flex min-w-0 items-center gap-3 border-t border-gray-200 pt-3 md:ml-auto md:border-0 md:pt-0">
                {/* Plain text in JSX: React escapes it, so a name like "<img onerror=...>" is shown, never run.
                    A name can be 100 characters: cut it off with "…" instead of pushing "Log out" out of the row.
                    `min-w-0` on BOTH this box and the name: a flex item never shrinks below its content by default,
                    so without it the box keeps the name's full 12rem even when the row has no room. */}
                <span title={user.name} className="max-w-48 min-w-0 truncate text-sm text-gray-700">
                  {user.name}
                </span>
                {/* `shrink-0`: only the name gives up room, the button never squeezes into two lines. */}
                <Button
                  variant="secondary"
                  size="sm"
                  isLoading={isLoggingOut}
                  onClick={handleLogout}
                  className="shrink-0"
                >
                  Log out
                </Button>
              </div>
            )}
          </div>
        </nav>
        {/* A live region is only announced reliably if it is already on the page when its text changes,
            so this wrapper always stays mounted and only the message inside comes and goes. */}
        <div role="status">
          {!isOnline && (
            <p className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900 sm:px-8">
              You are offline. Some features may not work until the connection is back.
            </p>
          )}
        </div>
      </header>
      {/* 16 px side padding on phones (32 px would leave too little room for the content), 32 px from `sm` up. */}
      <main className="mx-auto max-w-2xl px-4 py-6 sm:p-8">
        {/* Shown while a page's code downloads. Inside <main>, so the header stays visible. */}
        <Suspense fallback={<Spinner label="Loading page" className="text-blue-600" />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
