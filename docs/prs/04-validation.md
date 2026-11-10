# PR 04: Request validation with Zod

## What and why
Every value from the client is untrusted. A `validate({ body, params, query })` middleware checks it with a Zod schema
before the handler runs. Handlers get typed, clean data. Unknown fields (e.g. `role: "admin"`) are dropped, which
protects against mass assignment. Bad input → `400 VALIDATION_ERROR` with a `details` list per field.
Topics: API security, and the server-side half of XSS/injection defense (reject bad data early).

## Changes
- `backend-express/src/lib/validation/core.ts`: `validateRequest` (framework-free, collects errors of all parts) and `toErrorDetails`.
- `backend-express/src/lib/validation/express.ts`: `validate()` middleware; typed `req.body`/`params`/`query` in the handler.
- `backend-express/src/lib/validation/index.ts`, `README.md`: public API and usage.
- `backend-express/src/app/routes/demo.ts`: `POST` and `GET /api/demo/validation` to try it out.
- `backend-express/src/app/app.ts`: mounts the demo router only when `config.enableDemoRoutes` is on.
- `backend-express/src/app/config.ts`, `.env.example`: new optional `ENABLE_DEMO_ROUTES` (default: on in development,
  off in production). Demo routes are extra attack surface, so production gets them only on purpose.

## How to test
```bash
cd backend-express && npm run dev
U=localhost:4000/api/demo/validation
curl -s -X POST $U -H 'Content-Type: application/json' -d '{"name":" Ana ","email":"ana@example.com","role":"admin"}'
# {"received":{"name":"Ana","email":"ana@example.com"}}       ← trimmed, "role" dropped
curl -s -X POST $U -H 'Content-Type: application/json' -d '{"name":"","email":"nope"}'
# 400 VALIDATION_ERROR, details: name "Too small...", email "Invalid email address"
curl -s "$U?page=3&sort=oldest"   # {"received":{"page":3,"sort":"oldest"}}  ← "3" became a number
curl -s "$U?page=abc"             # 400 VALIDATION_ERROR, details: page
```

## How to reuse in another project
Copy `src/lib/validation/` and `src/lib/errors/`, install `zod`. Wiring:
```ts
const createPost = z.object({ title: z.string().min(1), content: z.string() });
router.post('/posts', validate({ body: createPost }), (req, res) => {
  req.body.title; // typed string
});
app.use(errorHandler()); // from lib/errors: turns VALIDATION_ERROR into JSON
```

## Verification
- `npm run typecheck` and `npm run build`: no errors.
- Temporary type test (not committed): `req.params.id` is a `number` after `z.coerce.number()`; `req.body.role` and an unvalidated `req.query` are type errors.
- Smoke test (`curl`): the 7 cases above plus "no body" and "body is an array" → 400 with `field: "body"`. `password` in a failed body is `[REDACTED]` in the log.
- Demo flag: `/api/demo/validation` → 200 in development, 404 in production, 200 in production with `ENABLE_DEMO_ROUTES=true`;
  `ENABLE_DEMO_ROUTES=yesplease` stops the server at startup with a clear message.

## Interview questions
1. **What is mass assignment?** Copying the whole request body into a model, so a client can set fields it should not
   (`role`, `isVerified`). Fix: an allowlist schema that keeps only known fields.
2. **Why validate on the server if the frontend already validates?** Anyone can call the API directly with `curl`.
   Frontend validation is for UX; server validation is for security.
3. **Why "parse, don't validate"?** The schema returns new, typed data (trimmed, coerced, defaults applied) instead of
   only saying yes/no, so the rest of the code cannot use the raw input by mistake.
