# PR 03: Central error handling (AppError, JSON 404, safe 500)

## What and why
Before this PR, Express answered unknown routes and errors with an HTML page, and outside production it printed the
stack trace into the response. Now every error has the same JSON shape with a stable `code` and the `requestId`.
A 500 says only `Internal server error`; the real error, its stack, and `file:line` go to the server log.
Topics: API security (no information leaks) and DX (errors you can trace).

## Changes
- `backend-express/src/lib/errors/core.ts`: `AppError`, `toAppError` (anything thrown → AppError), `toErrorBody`, `sourceLocation`.
- `backend-express/src/lib/errors/express.ts`: `notFoundHandler()` and `errorHandler()` middleware.
- `backend-express/src/lib/errors/index.ts`, `README.md`: public API and usage.
- `backend-express/src/app/app.ts`: registers both handlers after the routes.
- `backend-express/src/lib/logger/express.ts`: the request line no longer has `err`. For a 5xx, pino-http only had a
  made-up `failed with status code 500` error with a useless stack. The real one is now logged by the error handler.

## How to test
```bash
cd backend-express && npm run dev
curl -i localhost:4000/api/nope
# 404 {"error":{"code":"NOT_FOUND","message":"Route not found","requestId":"..."}}
curl -i -X POST localhost:4000/api/health -H 'Content-Type: application/json' -d '{"password":"x",'
# 400 {"error":{"code":"BAD_REQUEST","message":"Bad Request","requestId":"..."}}
```
The `requestId` in the body matches the `X-Request-Id` header and the `reqId` in the log lines.

## How to reuse in another project
Copy `src/lib/errors/` (needs `express@^5` only for `express.ts`). Wiring:
```ts
app.use(createRequestLogger({ logger })); // sets req.id and req.log
app.use('/api', routes);
app.use(notFoundHandler());
app.use(errorHandler());
// in a route:
throw new AppError(403, 'FORBIDDEN', 'You cannot do that');
```

## Verification
- `npm run typecheck` and `npm run build`: no errors.
- Smoke test (`curl`): health 200, unknown route 404 JSON, invalid JSON 400 JSON. The password from the broken body is not in the logs.
- Temporary script (not committed): an async route that throws a `TypeError` → 500 `INTERNAL_ERROR` to the client;
  the log has the message, the stack, and `source: "src/__smoke/boom.ts:10:15"`. An `AppError(403, ..., { details })` → 403 with `details`.

## Interview questions
1. **Why not send `err.message` to the client for a 500?** It can contain internals (SQL, file paths, library
   versions) that help an attacker. Log it on the server; give the client a generic message and a request ID.
2. **Why a stable `code` and not just the message?** Messages change (wording, translations). The client branches on
   `code` (e.g. `TOKEN_EXPIRED` → refresh the token).
3. **Why `warn` for 4xx and `error` for 5xx?** 4xx is the client's mistake and is expected. 5xx is our bug and should
   wake someone up. Mixing them makes alerts useless.
