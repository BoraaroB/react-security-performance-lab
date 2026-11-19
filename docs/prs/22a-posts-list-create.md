# PR 22a: Posts list and "new post" form on the dashboard

## What and why
The dashboard now shows every post and has a form to publish a new one. It is the first page that uses the logged-in
session for real data: `authHttp` sends the access token on the GET and the token + CSRF header on the POST, through
the interceptors from 21a. The form uses the same rules as the server, and posts are shown as JSX text, so HTML in a
post is displayed, never run (goal.md: S1 XSS, S2 auth). Step 22 is split into 22a (this), 22b (optimistic delete), 22c (admin roles).

## Changes
- `frontend/src/features/posts/posts.api.ts`: `Post` type (same as the API's `PublicPost`), `POSTS_PATH`, `createPost()`.
- `frontend/src/features/posts/posts.schemas.ts`: `createPostSchema`, mirrors the server's (title trimmed + NFC, 1–200; content 1–10,000; no control characters).
- `frontend/src/features/posts/NewPostForm.tsx`: react-hook-form + Zod; server field errors with `applyServerErrors`; empties itself after success.
- `frontend/src/features/posts/PostFeed.tsx`: holds the list in state, adds a new post at the top (no second GET), renders the posts.
- `frontend/src/pages/DashboardPage.tsx`: `useFetch(authHttp, POSTS_PATH)` → spinner / `ErrorState` with "Try again" / `PostFeed`.

## How to test
API with `SEED_DEMO_ACCOUNTS=true` + `npm run dev` in `frontend/`. Log in as `user@example.com` / `User1234!`:
1. `/dashboard` → "No posts yet". Click "Publish" with empty fields → "Enter a title", "Write something".
2. Title `<img src=x onerror=alert(1)>`, content with line breaks and `<script>alert(2)</script>` → the post shows exactly that text, no alert.
3. Publish a second post → it is at the top; the form is empty again. Reload → same list from the API.
4. Stop the API and reload → "Could not load the posts" with "Try again".

## How to reuse in another project
App code, not a portable module. The pattern: load once with `useFetch`, then hand the list to a component that keeps it in state.
```tsx
const { data, error, isLoading, reload } = useFetch<PostsResponse>(authHttp, POSTS_PATH);
{data && <PostFeed initialPosts={data.posts} />}
```

## Verification
- `npm run typecheck`, `npm run lint`, `npm run build` (frontend): OK. `DashboardPage` chunk 0.34 → 2.55 kB (react-hook-form + Zod are shared with the login page).
- Headless Chromium (Playwright) against the Express API: steps 1–3 above pass (step 4 was not run; `ErrorState` itself was tested in step 19). No dialog opened and no `<img>` was
  rendered for the XSS-looking post. GET requests carry `Authorization`; POST requests carry `Authorization` and `X-CSRF-Token`.

## Review
- **security-reviewer:** no findings.
- **code-reviewer, should-fix (fixed):** the title rule had no `.normalize('NFC')`, so the client was stricter than the
  server: a title pasted in decomposed form (e.g. from a macOS file name) could fail "At most 200 characters" on the
  client while the server would accept it. Added, in the same order as the server (trim → NFC → length).
- **code-reviewer, should-fix (open, for the user):** ~165 inserted / ~8 deleted code lines, over the ~150 budget and
  not yet accepted by the user. No natural split: the form without the list (or the reverse) cannot be tested on its own.
- **code-reviewer, nit (fixed):** `MAX_TITLE_LENGTH` / `MAX_CONTENT_LENGTH` were exported but unused elsewhere.
- **code-reviewer, nit (fixed):** interview answer 2 now says the client must never be STRICTER than the server.

## Interview questions
1. **A user posts `<script>alert(1)</script>`. Why is that safe here?** React puts JSX text into the page as text
   (`textContent`), never as HTML. It becomes dangerous only with `dangerouslySetInnerHTML`, `innerHTML`, or a URL in `href` (step 23).
2. **Why validate the form on the client if the server validates anyway?** Only for quick feedback. Anyone can skip
   the browser (curl, DevTools), so the server's schema is the real rule. The client copy must never be STRICTER than
   the server (it would block valid input); if it is looser, the server's field errors still show up on the inputs.
3. **After a POST, why add the returned post to state instead of refetching?** One request instead of two, and no
   flash to a loading spinner. The server's answer is the source of truth for the new post (its `id`, `createdAt`, author).
