# PR 12b: Posts: `GET /api/posts` + `POST /api/posts`

## What and why
The first real resource that users create. Any logged-in user can list all posts and create their own. The security
points (goal.md: "authentication and authorization", "API security", XSS): the author is always the logged-in user,
never a value from the body (mass assignment); the response shows the author's `id` and `name` only, never the email
(excessive data exposure); content is stored as typed, not "cleaned": XSS is stopped when the text is shown (output
encoding in React), not by changing input. Deleting with an ownership check comes in 12c.

## Changes
- `backend-express/src/app/store.ts`: `PostRecord` + a `posts` Map (cleared by `reset()`).
- `backend-express/src/app/repositories/posts.repository.ts`: `create` (random UUID, `createdAt`), `findAll` (newest first).
- `backend-express/src/app/schemas/posts.schemas.ts`: `createPostSchema`: title 1–200 (one line, no control or
  invisible characters), content 1–10,000 (fits the 32 kb JSON limit; no control characters except newline, CR, tab).
  Other fields are stripped.
- `backend-express/src/app/services/posts.service.ts`: `listPosts`, `createPost(author, input)` → `PublicPost`
  `{ id, title, content, createdAt, author: { id, name } | null }`.
- `backend-express/src/app/controllers/posts.controller.ts`: `list` → `{ posts }`, `create` → 201 `{ post }`;
  no `req.user` (wiring mistake) → 500, checked with one `if` inside `create`.
- `backend-express/src/app/routes/posts.routes.ts`: `no-store`, then `requireUser` for the whole router, then the routes.
- `backend-express/src/app/app.ts`, `src/index.ts`: `createApp({ users, posts, refreshTokens })`, router at `/api/posts`.

## How to test
`npm run dev` in `backend-express`, then (the CSRF + login setup from PR 12a):
```bash
O='Origin: http://localhost:5173'; J='Content-Type: application/json'
T=$(curl -s -c jar.txt localhost:4000/api/auth/csrf | node -pe 'JSON.parse(require("fs").readFileSync(0)).csrfToken')
USER=$(curl -s -b jar.txt -c jar.txt -H "$O" -H "$J" -H "X-CSRF-Token: $T" -d '{"email":"user@example.com","password":"User1234!"}' \
  localhost:4000/api/auth/login | node -pe 'JSON.parse(require("fs").readFileSync(0)).accessToken')
curl -i localhost:4000/api/posts                                   # 401 UNAUTHORIZED
curl -s -b jar.txt -H "$O" -H "$J" -H "X-CSRF-Token: $T" -H "Authorization: Bearer $USER" \
  -d '{"title":"Hi","content":"<b>text</b>","authorId":"someone-else"}' localhost:4000/api/posts  # 201, author = User Demo
curl -s -H "Authorization: Bearer $USER" localhost:4000/api/posts  # { posts: [...] }, newest first
```

## How to reuse in another project
Nothing new in `src/lib/`: this is app code. The pattern to copy is routes → controller → service → repository, with
`requireUser` on the router and `validate({ body })` on the write route.

## Verification
- `npm run typecheck` and `npm run build`: no errors.
- Smoke test (`tsx src/index.ts` + curl): no token → 401 + `no-store`; empty list → `{"posts":[]}`; create → 201,
  title trimmed, `<script>` kept as text, sent `authorId`/`id` ignored (author = logged-in user); list → newest first;
  zero-width space in title + blank content → 400 with both fields in `details`; no CSRF token → 403 `CSRF_INVALID`;
  200 + 10,000 CJK characters (30,626 bytes, 3 bytes each) → 201, not 413; 10,001 characters → 400.
- After the review fix: content with `\n`, `\r\n`, `\t` and 👩‍💻 → 201; NUL or ESC in content → 400
  "Must not contain control characters"; 6,000 escaped control characters (36 kb) → 413 (body limit runs first).

## Review
- **security-reviewer:** no findings.
- **code-reviewer (nit) → fixed:** `content` accepted every control character (NUL, ESC, ...), while its comment only
  justified newlines. Now only `\n`, `\r`, `\t` are allowed → `VALIDATION_ERROR` "Must not contain control characters".
  Invisible format characters (`\p{Cf}`) stay allowed in content on purpose: emoji like 👩‍💻 need the zero-width
  joiner; the title still rejects them (anti-spoofing). Note: JSON encodes a control character as `\u00XX` (6 bytes),
  so a body with more than ~5,400 of them is still over 32 kb and gets 413 before validation runs. Either way it is
  rejected, and normal text never contains them. Accepted.
- **User's review → simplified for readability** (second commit, no behavior change): the `currentUser()` helper is
  now one `if` inside `create`; the regexes have names (`NO_CONTROL_CHARACTERS_EXCEPT_LINE_BREAKS`); shorter comments;
  `toPublicPost` lists each field on its own line. Typecheck, build and the smoke test were run again: same results.

## Interview questions
1. **Why not strip HTML from posts on the server?** XSS depends on where text is shown (HTML, attribute, URL, JS). The safe
   default is to store text as typed and encode it on output (React escapes `{content}`). Stripping on input breaks real
   content and gives false confidence; sanitizing with DOMPurify is for the case where you must render HTML.
2. **What is mass assignment, and how is it prevented here?** Copying request fields straight into a record lets a client
   set fields it should not (`authorId`, `role`). The Zod schema allowlists `title` and `content`; the service sets the author from `req.user`.
3. **Why does the post show `author.id` but not the email?** Every user reads every post; send only what the page needs
   (OWASP API3: excessive data exposure). The frontend hiding a field is not enough: it is still in the response.
