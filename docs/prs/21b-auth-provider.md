# PR 21b: AuthProvider (restore the session on load, login/register/logout, user in the header)

## What and why
The app now knows who is logged in. An `AuthProvider` (React context) restores the session on every page load: the
access token lived only in memory and is gone after a reload, but the httpOnly refresh cookie is still there, so one
`POST /api/auth/refresh` returns a new token AND the user. Login, register and logout go through `useAuth()`, and the
header shows the user's name and a "Log out" button. Covers S1/S2 (token storage, session handling). Step 2 of 3 for plan step 21.

## Changes
- `frontend/src/features/auth/auth.http.ts`: the single-flight refresh is now the exported `refreshSession()`, which also
  returns the user. The interceptor and the restore on load share ONE request, so the refresh token is never sent twice.
- `frontend/src/features/auth/auth.api.ts`: `restoreSession()` (401 → `null`, "nobody is logged in") and `logout()`
  (forgets the access token only after the server revoked the session).
- `frontend/src/features/auth/auth.context.ts` (new): `AuthContext` + `useAuth()` (throws outside the provider).
- `frontend/src/features/auth/AuthProvider.tsx` (new): `user`, `isRestoring`, `login`, `register`, `logout`; the effect cleanup ignores a cancelled run.
- `frontend/src/main.tsx`: `<AuthProvider>` around the router.
- `frontend/src/layouts/RootLayout.tsx`: "Log in"/"Register" only for guests (hidden while restoring, so they do not flash); name + "Log out" for users (the button shows a spinner while the logout request runs).
- `LoginPage.tsx`, `RegisterPage.tsx`: call `useAuth()` instead of the API functions, so the header updates at once.
  The submit button is disabled while the session check runs (see Review).

~185 inserted / ~22 deleted code lines: over the ~150 budget, accepted with the 3-PR split for step 21.

## How to test
```bash
cd backend-express && npm run dev
cd frontend && npm run dev
```
1. Open http://localhost:5173, log in as `user@example.com` / `User1234!` → the header shows "User Demo" + "Log out".
2. Reload → still logged in. Network tab: exactly ONE `POST /api/auth/refresh` (even with StrictMode's double effect).
3. "Log out" → toast "Logged out", the guest links come back. Reload → still logged out (`/refresh` → 401).
4. Stop the API and click "Log out" → error toast, and you stay logged in (the session was not revoked).

## How to reuse in another project
`features/` is app code, not a portable module. To reuse it, copy `features/auth/` together with `lib/http/`, then change the
API paths and the `AuthUser` type.
```tsx
<AuthProvider>
  <RouterProvider router={router} />
</AuthProvider>
// in any component:
const { user, isRestoring, login, logout } = useAuth();
```

## Verification
- `npm run typecheck`, `eslint src`, `vite build` (frontend): OK. The main chunk grew by ~6 kB (~2.5 kB gzip): the
  HTTP client and the auth code are now in the first download, because the session check runs on every page load.
- curl against the Express API, in the same order the provider uses: refresh without a cookie → 401; login → 200;
  refresh → 200 with `user`; logout → 204; refresh → 401.

## Review
- **security-reviewer, low (fixed):** a successful refresh always wrote its token. A login, or a logout, that finished
  while the refresh was running was overwritten: after "Logged out" the tab could still send the old JWT. Now
  `auth.http.ts` writes the token only if it did not change during the refresh (the same check the 401 path already had).
- **code-reviewer, should-fix (fixed):** the token guard alone is not enough for "log in during the load-time check":
  if the refresh answers last, its `Set-Cookie` (the OLD account's) wins, so the header says B while the session is A.
  The client cannot decide which cookie wins, so Log in / Register cannot submit while `isRestoring`. The
  `currentUser ?? restoredUser` guard was removed (no longer needed). The leftover risk is in Known gaps, and 21c's GuestRoute closes it.
- **code-reviewer, nit (fixed):** a double click on "Log out" sent two requests and showed two toasts. The button now has `isLoading`.
- **code-reviewer, nit (fixed):** the PROGRESS row now says the line count is over budget, accepted with the split.

## Interview questions
1. **Where do you keep the access token in a SPA, and how does the user stay logged in after a reload?**
   In memory (a module variable), never in localStorage, which any XSS can read. On load, the app calls `/refresh`. The
   httpOnly refresh cookie (scripts cannot read it) proves the session, and the response brings a new access token + the user.
2. **Why `useMemo` for the context value?** Every consumer re-renders when the value is a new object. Without it, each
   render of the provider would re-render every component that calls `useAuth()`.
3. **Is hiding "Log out" or an admin link on the frontend a security control?** No, only UX. Anyone can call the API
   directly. The server checks the token and the role on every request.
