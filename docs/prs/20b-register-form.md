# PR 20b: Register form

## What and why
A `/register` page built the same way as the login form (20a): react-hook-form + a Zod schema that mirrors the
server's `registerSchema`, server errors on fields. It covers goal S1: the same validation rules on both sides
(name without invisible characters, password ≥ 15 characters and ≤ 72 bytes). The browser only gives quick
feedback; the server still decides. The text "error → message" moved to one shared function, so the two pages do not copy it.
Size: ~160 inserted / ~25 deleted code lines (moving the login error text and `fetchCsrfToken` adds to it); in-page
"Create one" / "Log in" links were left out (a nav link instead) to stay near the ~150 budget.

## Changes
- `src/features/auth/auth.schemas.ts`: `registerSchema` (name, email, password rules) and one shared `email` rule.
- `src/features/auth/auth.api.ts`: `register()`; the CSRF fetch is now `fetchCsrfToken()`, used by login and register.
- `src/features/auth/auth.errors.ts`: `getAuthErrorMessage(error)`: form-level text by `code` / error type (moved out of `LoginPage`).
- `src/pages/RegisterPage.tsx`: the form; `409 EMAIL_TAKEN` shown on the email field.
- `src/pages/LoginPage.tsx`: uses `getAuthErrorMessage`.
- `src/router/*`, `src/layouts/RootLayout.tsx`: `/register` route (lazy) + nav link "Register" with preload.

## How to test
```bash
cd backend-express && npm run dev     # demo accounts are seeded by default in development (needed for case 4)
cd frontend && npm run dev            # open http://localhost:5173/register
```
1. Submit empty → "Enter your name", "Enter a valid email address", "At least 15 characters"; focus on Name.
2. Name `Bob` followed by a zero-width space (U+200B; in the DevTools console: `copy('Bob\u200B')`, then paste) → "Must not contain control or invisible characters".
3. Password of 40 Cyrillic letters (`жжж…`, 80 bytes) → "Too long: at most 72 bytes …".
4. Email `user@example.com` (a demo account) + a valid password → "An account with this email already exists." on Email.
5. A new email → toast "Welcome, Bob! Your account is ready.", the form is emptied (DevTools: `__Secure-refresh_token` cookie is set).

## How to reuse in another project
Nothing new to copy: the page uses `lib/forms` and `lib/http` from 20a. The pattern for an error with a `code` but no `details`:
```tsx
if (error instanceof ApiError && error.code === 'EMAIL_TAKEN') {
  setError('email', { message: 'An account with this email already exists.' }, { shouldFocus: true });
  return;
}
```

## Verification
- `npm run typecheck`, `npm run lint`, `vite build`: pass. react-hook-form + Zod are now one shared chunk (120 kB,
  38 kB gzip) for both pages; `LoginPage` and `RegisterPage` are ~1.5 kB each; main file 384.8 kB (+0.2 kB routes).
- Headless Chromium against the running Express API: the 5 cases above give the expected field errors, focus and toast
  (API log: `POST /api/auth/register → 409`, then `→ 201`).

## Review
- **security-reviewer:** no findings.
- **code-reviewer** (1 should-fix + 3 nits, all fixed):
  - After a successful register the form kept its values, so a second click got a confusing 409 and used one of the
    5 register tries per hour. Now `reset()` empties the form. Login and register still stay on the page; that is
    in Known gaps until step 21's GuestRoute + redirect.
  - The password hint hard-coded "15". It now uses the exported `MIN_PASSWORD_CHARACTERS`.
  - "needs SEED_DEMO_ACCOUNTS" was misleading (seeded by default in development). Reworded.
  - The size was not stated. Added to "What and why" and the PROGRESS row.
- Re-checked after the fixes: typecheck, lint, build, and both headless Chromium tests (register + login).

## Interview questions
- **Why count password length with `[...value].length` instead of `value.length`?** `.length` counts UTF-16 units,
  so an emoji counts as 2; spreading the string counts Unicode code points, what a user sees as characters.
- **Why is the maximum in bytes?** bcrypt only reads the first 72 bytes; a longer password would be silently cut,
  and a Cyrillic letter takes 2 bytes, an emoji 4.
- **Does "email already taken" leak information?** Yes: it tells anyone which emails have accounts. Only email
  verification (send a link instead of an error) hides it; this project accepts the leak (see Known gaps).
