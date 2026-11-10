# validation

Validates request body, URL params, and query string with Zod before the handler runs. Handlers get typed, clean
data; unknown fields are dropped (mass-assignment protection); bad input becomes `400 VALIDATION_ERROR` with `details`.

## Dependencies
- npm: `zod@^4`, `express@^5` (only for `express.ts`)
- lib: `errors` (throws `AppError`; the error handler from `lib/errors` turns it into JSON)

## Usage

```ts
import { z } from 'zod';
import { validate } from './lib/validation/index.js';

const createPost = z.object({ title: z.string().trim().min(1).max(120), content: z.string().max(10_000) });
const postId = z.object({ id: z.uuid() });

router.post('/', validate({ body: createPost }), (req, res) => {
  req.body.title; // string, already trimmed; extra fields like `authorId` are gone
});
router.delete('/:id', validate({ params: postId }), (req, res) => {
  req.params.id; // string, a valid UUID
});
```

Error response:
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Request validation failed",
  "details": [{ "field": "title", "message": "Too small: expected string to have >=1 characters" }], "requestId": "..." } }
```

## Notes
- `field` is the path inside its part (`title`, `tags.0`). If the whole part is wrong (e.g. no JSON body), `field` is the part name (`body`).
- Errors from all parts are collected, so the client sees every problem at once.
- Query values are always strings: use `z.coerce.number()` and `.default(...)`.
- `z.object` drops unknown keys. Use `z.strictObject` if you prefer to reject them with an error.
- A part without a schema is typed `unknown` in the handler, so unvalidated input cannot be used by accident.
- Express 5 makes `req.query` read-only; the middleware redefines it on the request with the parsed value.

## API
| Export | Description |
|---|---|
| `validate({ params?, query?, body? })` | Express middleware |
| `validateRequest(schemas, { params, query, body })` | Framework-free: returns parsed parts or throws `AppError` |
| `toErrorDetails(issues, part)` | Zod issues → `[{ field, message }]` |

## How to reuse
Copy `src/lib/validation/` and `src/lib/errors/`, install `zod`. In an ESM project, import with the `.js` extension;
in CommonJS (e.g. NestJS) drop it. In Nest, call `validateRequest` from a pipe.
