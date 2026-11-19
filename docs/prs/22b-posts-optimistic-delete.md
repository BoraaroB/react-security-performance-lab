# PR 22b: Delete posts with `useOptimistic`

## What and why
Authors (and admins) can delete a post. The post disappears at once, before the server answers (optimistic UI), and
comes back on its own if the request fails. React 19's `useOptimistic` does the "come back" part: the optimistic list
lives only while transitions are running. The "Delete" button is shown only to the author or an admin, but that is UX: the
API checks ownership on every DELETE (goal.md: S2 authorization, P1 rendering).

## Changes
- `frontend/src/features/posts/posts.api.ts`: `deletePost(id)` (`DELETE /api/posts/:id`, id passed through `encodeURIComponent`).
- `frontend/src/features/posts/PostFeed.tsx`: `useOptimistic` over the `posts` state, `handleDelete` in `startTransition(async ...)`,
  "Delete" button per post (author or admin), `404` = already deleted, `403` gets its own message (no "try again").

## How to test
API with `SEED_DEMO_ACCOUNTS=true` + `npm run dev` in `frontend/`.
1. As `user@example.com` / `User1234!`, publish two posts. As `admin@example.com` / `Admin123!` (other browser), publish one.
   The user sees "Delete" only on their own posts; the admin sees it on all of them.
2. DevTools → Network → throttling "Slow 4G", click "Delete": the post disappears at once, the toast comes later.
3. Stop the API, click "Delete": the post disappears, then comes back with "Could not delete the post".
4. Admin deletes a user's post; the user (without reloading) clicks "Delete" on it → the server says 404, the post stays gone.

## How to reuse in another project
The pattern, for any list:
```tsx
const [items, setItems] = useState(initialItems);
const [visibleItems, hideItem] = useOptimistic(items, (current, id: string) => current.filter((i) => i.id !== id));
startTransition(async () => {
  hideItem(id);
  try {
    await api.delete(id);
  } catch {
    showError(); // the item comes back by itself; an uncaught error would only reach the console
    return;
  }
  startTransition(() => setItems((current) => current.filter((i) => i.id !== id)));
});
```

## Verification
- `npm run typecheck`, `npm run lint` (frontend): OK.
- Headless Chromium (Playwright) against the Express API, with DELETE delayed or faked by `page.route`: buttons per
  role as in step 1; with a 1.5 s delay the post is gone 200 ms after the click; a faked 500 brings the post back with
  the error toast; a real 404 (deleted by the admin first) keeps it gone; after a reload the list matches the server.

## Review
- **security-reviewer:** no findings.
- **code-reviewer, should-fix (fixed in comments/docs):** React 19 groups ("entangles") all pending async transitions
  (`entangleAsyncAction` in react-dom), so optimistic values are dropped only when EVERY pending delete has settled.
  With a slow delete of A and a fast failing delete of B, B's error toast shows at once but B reappears only when A
  finishes. No code change; the comment, PROGRESS and interview answer 1 now say this. Listed in Known gaps (low).
- **code-reviewer, nit (fixed):** the reuse snippet had no try/catch; a rejection would go to React's global error
  reporting, not to the user. The snippet now catches like the real code.
- **code-reviewer, nit (fixed):** `403 FORBIDDEN` said "Please try again", which can never help (e.g. the admin role
  was removed meanwhile). It now gets its own message, mapped by `code` as CLAUDE.md asks.

## Interview questions
1. **What does `useOptimistic` give you over setting state yourself?** It shows a temporary value only while
   transitions run. When they end, React goes back to the real state, so a failed request needs no rollback code.
   Detail: React 19 groups all pending async transitions, so a failed delete's post comes back only after every
   delete in progress has settled.
2. **Why `startTransition` again after the `await`?** React cannot track an async function across an `await`, so a
   state update after it is no longer part of the transition. Wrapping it again keeps it in the same transition (React 19 docs).
3. **Is hiding the "Delete" button enough?** No. Anyone can send `DELETE /api/posts/<id>` with their own token. The
   server compares the post's author with the logged-in user (IDOR protection) and returns 403.
