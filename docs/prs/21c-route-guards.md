# PR 21c: Route guards and a safe redirect after login

## What and why
Pages now have access groups: `GuestRoute` (login, register), `ProtectedRoute` (logged-in users) and `RequireRole`
(admins, nested inside `ProtectedRoute`). Each guard is a pathless layout route: it renders the page (`<Outlet />`),
a spinner while the session check runs, or a redirect. A guest who opens a protected page goes to
`/login?redirectTo=...` and comes back there after login; `redirectTo` is checked so the login page cannot be used as
an **open redirect**. The guards only improve the UX: the API still checks the token and role on every request (goal.md: S1, S2).

## Changes
- `frontend/src/router/ProtectedRoute.tsx`: waits for `isRestoring`; no user → `<Navigate>` to login with `redirectTo` (path + query + hash).
- `frontend/src/router/GuestRoute.tsx`: waits for `isRestoring`; a logged-in user goes to `redirectTo` (only a path on our own origin) or the dashboard.
- `frontend/src/router/RequireRole.tsx`: `allowedRoles` (same name as the API's `authorize()`); wrong role → "No access". Fails closed when `user` is null.
- `frontend/src/router/routes.tsx`: the three groups as pathless routes; admin is nested inside protected.
- `frontend/src/pages/DashboardPage.tsx`, `AdminPage.tsx`: small lazy pages to guard (step 22 fills them in).
- `frontend/src/router/paths.ts`, `lazy-pages.ts`: `dashboard`, `admin`.
- `frontend/src/layouts/RootLayout.tsx`: "Dashboard" link for users, "Admin" link for admins.
- `frontend/src/pages/LoginPage.tsx`, `RegisterPage.tsx`: no more `disabled={isRestoring}` (the form is not shown during the check)
  and no `reset()` after register (`GuestRoute` moves the user away).

## How to test
API with demo accounts (`SEED_DEMO_ACCOUNTS=true`) + `npm run dev` in `frontend/`:
1. Logged out, open `http://localhost:5173/dashboard?tab=x` → `/login?redirectTo=%2Fdashboard%3Ftab%3Dx`. Log in as `user@example.com` / `User1234!` → back on `/dashboard?tab=x`.
2. Open `/admin` → "No access". Open `/login` → sent to `/dashboard`. Reload `/dashboard` → still there.
3. Log out → back on the login page. The Back button cannot show the dashboard again.
4. Logged out, open `/login?redirectTo=https://evil.example` (also `//evil.example`, `/\evil.example`, `/.//evil.example`,
   `javascript:alert(1)`), log in → `/dashboard`, never the other site.
5. Log in as `admin@example.com` / `Admin123!` from `/admin` → `/admin` shows; the header has "Admin".

## How to reuse in another project
App code, not a portable module. Copy the three guard files, replace `useAuth()` and `PATHS` with your own, then:
```tsx
{ element: <ProtectedRoute />, children: [
  { path: '/dashboard', element: <DashboardPage /> },
  { element: <RequireRole allowedRoles={['admin']} />, children: [{ path: '/admin', element: <AdminPage /> }] },
] }
```

## Verification
- `npm run typecheck`, `npm run lint`, `npm run build` (frontend): OK. New chunks: `DashboardPage` 0.34 kB, `AdminPage` 0.35 kB.
- Headless Chromium (Playwright) against the Express API: all 5 scenarios above pass, including all 5 open-redirect
  attempts. Console errors: only the expected 401 from `POST /refresh` on load in a logged-out browser.

## Review
- **security-reviewer:** no findings (checked: the URL is parsed before the check, `<Navigate>` only does `pushState`,
  `RequireRole` fails closed, and the forms cannot be submitted during the session check even without `disabled`).
- **code-reviewer, should-fix (fixed):** the comment said that without the check a user would land on the fake site.
  The installed React Router 7.18 already throws "External navigation is not allowed" for an external `<Navigate>`
  (the user sees the error page). The comment and interview answer 2 now say this. Our check still turns a bad value into
  the dashboard, and it still protects if a redirect is ever done with `window.location`.
- **code-reviewer, nit (kept, documented):** `getSafeRedirectPath` has one call site. It stays a named function on
  purpose: a security check with a try/catch and early returns reads worse inline, and step 34 can test it.
- **code-reviewer, nit (accepted, documented):** logging out on a protected page leads to `/login?redirectTo=<that page>`,
  so the next person who logs in on that browser lands there (an admin page shows "No access"). Going from login to
  "Register" drops `redirectTo`. Both are harmless; listed in PROGRESS.

## Interview questions
1. **Is a `ProtectedRoute` a security control?** No. The JS bundle is public and anyone can call the API directly.
   It only stops the UI from showing a page that would fail anyway; the server checks the token and role on every request.
2. **What is an open redirect and how do you prevent it here?** A `redirectTo` from the URL that sends a freshly
   logged-in user to an attacker's site (good for phishing). Resolve it with `new URL(value, location.origin)`, accept it
   only if the origin is ours and the path does not start with `//`, otherwise use a fixed default. React Router 7.18+
   also throws on an external `<Navigate>`, but that shows an error page, and `window.location = redirectTo` has no such check.
3. **Why must the guards wait for `isRestoring`?** On a reload the access token is gone and `user` is `null` until
   `POST /refresh` answers. A guard that does not wait would send every logged-in user to the login page on every reload.
