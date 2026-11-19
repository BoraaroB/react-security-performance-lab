# PR 20a: Login form (react-hook-form + Zod, server errors on fields)

## What and why
A `/login` page with react-hook-form and a Zod schema: the browser checks the fields for quick feedback, the server
checks them again (anyone can skip browser checks), and the server's validation errors appear under the matching
input. Covers goal S1 (input validation on both sides, CSRF on a real form). Step 20 was split (20a login, 20b
register, 20c GitHub link); the login really submits now, with a temporary CSRF fetch that step 21 replaces.
Size: ~170 code lines + 2 READMEs, a bit over the ~150 budget (the real submit was the user's choice).

## Changes
- `frontend/package.json`: `react-hook-form` 7.91, `zod` 4.6, `@hookform/resolvers` 5.9 (connects Zod to the form; not named in the plan, but the standard bridge).
- `src/lib/forms/`: `applyServerErrors(error, setError, fieldNames)`: `ApiError.details` → field errors, items checked, first field focused.
- `src/lib/http/client.ts`: `headers` request option (for `X-CSRF-Token`); headers still go only to the API origin.
- `src/config/http.ts`: `authHttp` client with `credentials: 'include'` (API on another origin needs its cookies).
- `src/features/auth/auth.schemas.ts`: `loginSchema` mirroring the server's rules.
- `src/features/auth/auth.api.ts`: `login()` = `GET /api/auth/csrf`, then `POST /api/auth/login` with `X-CSRF-Token`.
- `src/pages/LoginPage.tsx`: the form; errors by `code` (never the server's text), lazy loaded.
- `src/router/*`, `src/layouts/RootLayout.tsx`: `/login` route + nav link with preload.

## How to test
```bash
cd backend-express && npm run dev     # needs SEED_DEMO_ACCOUNTS
cd frontend && npm run dev            # open http://localhost:5173/login
```
1. Submit empty → "Enter a valid email address", "Enter your password", focus on Email.
2. `user@example.com` + an 80-character password → the server's 400 shows under Password (no browser rule for it).
3. Wrong password → red alert "Wrong email or password."
4. `user@example.com` / `User1234!` → toast "Logged in as User Demo"; DevTools → Application → Cookies: `__Host-csrf` and `__Secure-refresh_token`, both httpOnly.

## How to reuse in another project
Copy `src/lib/forms/` and `src/lib/http/`, install `react-hook-form` (plus `zod` + `@hookform/resolvers` for the schema).
```tsx
} catch (error) {
  if (applyServerErrors(error, setError, ['email', 'password'])) return;
  setError('root.server', { message: MESSAGES[code] ?? 'Something went wrong.' });
}
```

## Verification
- `npm run typecheck`, `npm run lint`, `vite build`: pass. Main file 384 kB (unchanged); `LoginPage` chunk 121 kB (38 kB gzip, mostly Zod).
- Headless Chromium against the running Express API: the 4 cases above give the expected field errors, alert, toast,
  focus and cookies. The API log shows `"password": "[REDACTED]"`.

## Review
- **security-reviewer:** no findings.
- **code-reviewer** (4 nits, all fixed):
  - `LOGIN_ERROR_MESSAGES` was a plain object: an error `code` like `__proto__` found `Object.prototype` and crashed
    the `Alert`. Now a `Map` (no inherited keys).
  - `lib/forms` README said "72 bytes"; the login rule counts characters. Fixed.
  - PROGRESS known gap about `ApiError.details` still read as future work. Reworded: `lib/http` trusts the items,
    `applyServerErrors` checks them.
  - Size over budget was not stated. Added to "What and why" and the PROGRESS row.
- Re-checked after the fixes: typecheck, lint, build, and the headless Chromium login test.

## Interview questions
- **Why validate in the browser if the server validates anyway?** Browser checks are UX (instant feedback); they
  are not security, because a request can be sent with curl. The server is the only check that counts.
- **How does a form show a server-side validation error?** The API returns `details: [{ field, message }]`; the
  form maps known field names to `setError` and shows the rest as a form-level message chosen by the error `code`.
- **Why does the login page load lazily?** Zod and react-hook-form are ~120 kB; only visitors who log in need them,
  so they live in the page's own chunk, and hovering the nav link starts the download early.
