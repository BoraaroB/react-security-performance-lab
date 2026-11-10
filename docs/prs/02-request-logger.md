# PR 02: Request logger (pino), request ID, secret redaction

## What and why
Adds structured logging to the Express API. Every request gets a request ID (returned in `X-Request-Id`) and exactly
one log line: method, path, status, and duration. In development the line also shows the query and body; in production
it is one JSON object per line, without payloads. Passwords, tokens, and auth headers are always replaced with
`[REDACTED]`, so logs never leak secrets. Covers goal.md topics DX/observability and API security (S3).

## Changes
- `backend-express/src/lib/logger/core.ts`: **portable** `createLogger({ level, pretty, redactKeys })`: pino with redaction and ISO timestamps; `pino-pretty` in dev.
- `backend-express/src/lib/logger/express.ts`: **portable** `createRequestLogger({ logger, logPayloads, trustIncomingRequestId })`: pino-http with request ID, 4xx → `warn` / 5xx → `error`, path logged without the query string.
- `backend-express/src/lib/logger/index.ts`, `README.md`: public API and usage.
- `backend-express/src/app/logger.ts`: the app-wide logger, built from `config`.
- `backend-express/src/app/config.ts`, `.env.example`: optional `LOG_LEVEL` (default `debug` in dev, `info` in prod).
- `backend-express/src/app/app.ts`: the request logger is the first middleware.
- `backend-express/src/index.ts`: startup and graceful-shutdown messages go through the logger instead of `console`.
- `backend-express/package.json`: `pino`, `pino-http`; `pino-pretty` as a dev dependency (used only for pretty output).

## How to test
```bash
cd backend-express && npm install && npm run dev
curl -i 'localhost:4000/api/health?token=abc&page=2'
# → header X-Request-Id: <uuid>; log: INFO GET /api/health → 200 (… ms) reqId=<same uuid>, query.token = "[REDACTED]"
curl -i -X POST localhost:4000/api/nope -H 'Content-Type: application/json' -d '{"email":"a@b.c","password":"hunter2"}'
# → log: WARN POST /api/nope → 404 …, body.password = "[REDACTED]"
curl -i localhost:4000/api/health -H 'X-Request-Id: client-chosen-id'
# → a new UUID, not "client-chosen-id" (incoming IDs are not trusted by default)
npm run build && NODE_ENV=production npm start   # same requests → one JSON line each, no query/body
```

## How to reuse in another project
Copy `src/lib/logger/`, then `npm i pino pino-http` and `npm i -D pino-pretty`:
```ts
const logger = createLogger({ level: 'debug', pretty: !isProd });
app.use(createRequestLogger({ logger, logPayloads: !isProd })); // before express.json()
app.get('/x', (req, res) => { req.log.info('carries reqId'); res.json({ id: req.id }); });
```

## Verification
- `npm run typecheck`: passed. `npm run build`: passed.
- Dev smoke test: request ID header matches the log; `query.token`, `body.password`, and nested `body.profile.refreshToken` show `[REDACTED]`; 404/400 logged as `WARN`; a client-supplied `X-Request-Id` is replaced.
- Prod smoke test (`NODE_ENV=production node dist/index.js`): JSON lines with `reqId`, `method`, `path`, `statusCode`, `responseTime`; no `query`/`body`.
- Redaction check: `authorization`, `cookie`, and `set-cookie` under `req.headers`, plus a `password` 3 levels deep, all show `[REDACTED]`.
- Known gap: invalid JSON still gets Express's default error output (stack in the console, HTML response). Fixed in step 03.

## Interview questions
1. **Why a request ID?** It ties every log line of one request together and is returned to the client, so a user's
   error report ("request ID 9f2c…") leads straight to the right server logs, even across services.
2. **How do you keep secrets out of logs?** Central redaction in the logger (by key: `password`, `token`, `authorization`, …),
   no payload logging in production, no query strings in logged URLs, and log objects instead of concatenated strings.
3. **Why structured (JSON) logs in production?** Log tools (Datadog, ELK, Loki) can filter and aggregate by fields
   like `statusCode` or `reqId`; free text has to be parsed with fragile regexes. pino is also fast because it does little work on the main thread.
