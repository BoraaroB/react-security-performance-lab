# errors

One error class (`AppError`) and one JSON error format for the whole API. Clients get a stable `code`; a 500
never leaks a stack trace or internals. The real error goes to the server log, tied to the request ID.

## Dependencies
- npm: `express@^5` (only for `express.ts`; `core.ts` is framework-free)
- lib: none. Works best with `lib/logger` (or `pino-http`), which sets `req.id` and `req.log`.
  Without them, errors are logged to `console` and `requestId` is `"unknown"`.

## Usage

```ts
import { AppError, errorHandler, notFoundHandler } from './lib/errors/index.js';

app.use(createRequestLogger({ logger })); // first: sets req.id and req.log
app.use('/api/posts', postsRouter);
app.use(notFoundHandler()); // after all routes
app.use(errorHandler()); // last

// In a route (Express 5 also catches errors thrown in async handlers):
throw new AppError(403, 'FORBIDDEN', 'You cannot delete this post');
```

Response:
```json
{ "error": { "code": "FORBIDDEN", "message": "You cannot delete this post", "requestId": "9f2c1a..." } }
```

## What becomes what

| Thrown | Status | `code` | Message to the client |
|---|---|---|---|
| `AppError` | its status | its code | its message (+ `details`) |
| client error from a library (`status` 4xx + `expose: true`, e.g. invalid JSON) | same 4xx | from the status, e.g. `BAD_REQUEST` | generic (`Bad Request`) |
| anything else (a bug) | 500 | `INTERNAL_ERROR` | `Internal server error` |

Logs: 4xx → `warn` with one short line. 5xx → `error` with the original error, its stack, and `source`
(the first stack frame in your code, e.g. `src/app/routes/posts.ts:42:11`).

## API
| Export | Description |
|---|---|
| `new AppError(status, code, message, { details?, cause? })` | An error whose message is safe to show to the client |
| `toAppError(error)` | Turns anything thrown into an `AppError` (see the table) |
| `toErrorBody(appError, requestId)` | Builds the JSON body |
| `sourceLocation(error, rootDir?)` | `"file:line:column"` of the first frame outside `node_modules` |
| `notFoundHandler()`, `errorHandler()` | Express middleware |

## How to reuse
Copy `src/lib/errors/`. In an ESM project, import with the `.js` extension; in CommonJS (e.g. NestJS) drop it.
In Nest, call `toAppError` and `toErrorBody` from an exception filter instead of using `express.ts`.
