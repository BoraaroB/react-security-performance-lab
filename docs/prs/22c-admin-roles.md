# PR 22c: Admin page with the users table and role change

## What and why
The admin page now lists every user and lets an admin make someone an admin or a user again. It is the frontend for
`GET /api/admin/users` and `PATCH /api/admin/users/:id/role` (step 12d). The page is hidden from non-admins by
`RequireRole`, but the real check is on the server: it verifies the caller's role on every request, again right before
the write, and refuses an admin's change to their own role (goal.md: S2 authorization).

## Changes
- `frontend/src/features/admin/admin.api.ts`: `AdminUser` / `Role` types, `ADMIN_USERS_PATH`, `changeRole(userId, role)` (PATCH, id encoded).
- `frontend/src/features/admin/UserTable.tsx`: table (name, email, role `<Select>`), own row disabled, one save at a time
  (all selects disabled, spinner on the saving row), the select shows the old role until the server confirms, the
  returned user replaces the row, toast text by error `code`.
- `frontend/src/pages/AdminPage.tsx`: `useFetch(authHttp, ADMIN_USERS_PATH)` → spinner / `ErrorState` / `UserTable`.

## How to test
API with `SEED_DEMO_ACCOUNTS=true` + `npm run dev` in `frontend/`.
1. Log in as `admin@example.com` / `Admin123!`, open "Admin": two users; your own row says "(you)" and its role is disabled.
2. Set "User Demo" to `admin` → toast "User Demo is now an admin". In another browser, log in as `user@example.com` / `User1234!`: the header has "Admin".
3. While that page is open, set "User Demo" back to `user` in the first browser. In the second, change any role →
   "You are no longer an admin. Reload the page." and the select stays on the old value. Reload → "No access".

## How to reuse in another project
App code, not a portable module. The pattern for a security-relevant change: not optimistic, disable the control
while saving, show only what the server returned.
```tsx
const updatedUser = await changeRole(userId, role);
setUsers((current) => current.map((user) => (user.id === updatedUser.id ? updatedUser : user)));
```

## Verification
- `npm run typecheck`, `npm run lint`, `npm run build` (frontend): OK. `AdminPage` chunk 0.35 → 2.51 kB.
- Headless Chromium (Playwright) against the Express API: steps 1–3 above pass, including the 403 for the demoted
  admin (toast, select unchanged) and "No access" after the reload.

## Review
- **security-reviewer:** no findings.
- **code-reviewer, should-fix (fixed):** `savingUserId` held one id but only locked its own row. Saving row A, then
  row B, unlocked A while its PATCH was still running, so A could be sent twice and the answers could arrive out of
  order (the table could show a role the server no longer has). Now every select is disabled while any save runs.
- **code-reviewer, nits (fixed):** a comment now says the controlled select shows the old role until the server
  confirms; the toast text is built in its own line; the table has an `sr-only` caption; the PROGRESS row has the line
  count, and the "demoted admin keeps the page" case was added to the existing "dead session" known gap.
- **code-reviewer, nit (accepted):** a focused select that becomes disabled may lose keyboard focus. The forms'
  submit buttons already behave the same; noted in PROGRESS.

## Interview questions
1. **Why is the role change not optimistic, like the post delete?** The table would briefly show a role that the
   server may refuse. For a permission change, the UI should show only what the server confirmed.
2. **An admin was demoted, but their open tab still shows the Admin page. Is that a hole?** No. The tab only has old
   UI state; every API call loads the role from the store and answers 403. The UI catches up on the next reload.
3. **Why does the server refuse an admin changing their own role, when the UI already disables it?** The UI can be
   bypassed (DevTools, curl). The server rule makes sure at least one admin always remains.
