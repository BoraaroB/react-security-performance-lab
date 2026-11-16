# PR 12c: `DELETE /api/posts/:id`: only the author or an admin

## What and why
Users can now delete posts, but only their own; an admin can delete any post. This is **resource ownership**, the
check that stops IDOR (Insecure Direct Object Reference, OWASP API1 "Broken Object Level Authorization"): the post ID
in the URL is chosen by the caller, so being logged in is not enough; the server compares the post's `authorId` with
the logged-in user. goal.md topics: "authentication and authorization", "API security".

## Changes
- `backend-express/src/app/repositories/posts.repository.ts`: `findById` (returns a copy) and `delete`.
- `backend-express/src/app/schemas/posts.schemas.ts`: `postIdParamsSchema`: `id` must be a UUID (400 otherwise).
- `backend-express/src/app/services/posts.service.ts`: `deletePost(user, postId)`: unknown → 404 `NOT_FOUND`
  "Post not found"; not the author and not an admin → 403 `FORBIDDEN` (same message as `authorize`); else delete.
- `backend-express/src/app/controllers/posts.controller.ts`: `remove` → 204 No Content.
- `backend-express/src/app/routes/posts.routes.ts`: `DELETE /:id` with `validate({ params })`.

**404 vs 403:** 404 when the post does not exist, 403 when it exists but is not yours. Returning 403 is fine here
because every logged-in user already sees every post in `GET /api/posts`. For PRIVATE resources (e.g. someone else's
order or message), answer 404 for "not yours" too, so the API does not confirm that the ID exists.

## How to test
`npm run dev` in `backend-express`, then the setup from PR 12b (`O`, `J`, `T`, `USER`), plus:
```bash
ADMIN=$(curl -s -b jar.txt -c jar.txt -H "$O" -H "$J" -H "X-CSRF-Token: $T" -d '{"email":"admin@example.com","password":"Admin123!"}' \
  localhost:4000/api/auth/login | node -pe 'JSON.parse(require("fs").readFileSync(0)).accessToken')
NEW() { curl -s -b jar.txt -H "$O" -H "$J" -H "X-CSRF-Token: $T" -H "Authorization: Bearer $1" \
  -d '{"title":"t","content":"x"}' localhost:4000/api/posts | node -pe 'JSON.parse(require("fs").readFileSync(0)).post.id'; }
D() { curl -s -w " %{http_code}\n" -b jar.txt -H "$O" -H "X-CSRF-Token: $T" -H "Authorization: Bearer $1" -X DELETE localhost:4000/api/posts/$2; }
A=$(NEW $ADMIN); P1=$(NEW $USER); P2=$(NEW $USER)
D $USER $A        # 403 FORBIDDEN (the admin's post, not yours)
D $USER nope      # 400 VALIDATION_ERROR (not a UUID)
D $USER $P1       # 204 (owner)
D $USER $P1       # 404 NOT_FOUND (already deleted)
D $ADMIN $P2      # 204 (admin, not the author)
```

## How to reuse in another project
Nothing new in `src/lib/`. The pattern: validate the ID → load the resource → compare its owner with the logged-in
user (`req.user`, never a value from the request) → act. Put the check in the service, next to the data, not in the frontend.

## Verification
- `npm run typecheck` and `npm run build`: no errors.
- Smoke test (`tsx src/index.ts` + curl, a third user registered as `other@example.com`): another user → 403
  `FORBIDDEN`; no token → 401; no CSRF token → 403 `CSRF_INVALID`; `not-a-uuid` → 400; unknown UUID → 404;
  owner → 204 with `no-store` and security headers, then 404 on the second try; admin deletes the user's post → 204;
  list afterwards → `{"posts":[]}`.

## Review
- **security-reviewer:** no findings.
- **code-reviewer (nit) → fixed:** the service comment said "the frontend only hides the delete button", but there is
  no frontend yet. Now: "A UI may hide the delete button, but that is only UX."
- **code-reviewer (nit) → fixed:** the "How to test" script let the admin delete their own post, so it did not show
  the admin rule on its own. It now covers owner → 204 and admin deleting someone else's post → 204.

## Interview questions
1. **What is IDOR, and how is it prevented here?** An API that trusts an ID from the request without checking the
   caller may use that object (e.g. `DELETE /posts/123` deletes anyone's post). The service loads the post and compares
   `post.authorId` with `req.user.id`. Random UUIDs make IDs hard to guess, but they are NOT the protection: IDs leak (URLs, logs, lists).
2. **404 or 403 for "not yours"?** 403 when the caller may know the resource exists (public posts); 404 when they may
   not, so the API is not an oracle for which IDs exist. Unknown is always 404.
3. **Why is `authorize(['admin'])` (RBAC) not enough here?** RBAC answers "may this role use this route?". Ownership
   depends on the specific object, so it can only be checked after loading it (often called ABAC / object-level authorization).
