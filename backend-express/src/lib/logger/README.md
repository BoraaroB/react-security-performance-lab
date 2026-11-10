# logger

A pino logger with built-in secret redaction, plus Express middleware that logs one line per request and adds a
request ID. Secrets never reach the logs, and every log line can be traced back to the request that caused it.

## Dependencies
- npm: `pino@^10`, `pino-http@^11`; `pino-pretty@^13` only when `pretty: true` (a dev dependency is enough)
- lib: none

## Usage

```ts
import express from 'express';
import { createLogger, createRequestLogger } from './lib/logger/index.js';

const isProd = process.env.NODE_ENV === 'production'; // read env in your glue code, not in the module
export const logger = createLogger({ level: isProd ? 'info' : 'debug', pretty: !isProd });

const app = express();
app.use(createRequestLogger({ logger, logPayloads: !isProd })); // first middleware
app.use(express.json());

app.get('/api/x', (req, res) => {
  req.log.info('inside a handler'); // carries reqId automatically
  res.json({ requestId: req.id });
});
```

Dev output:
```
12:00:01.123 WARN: POST /api/auth/login → 401 (245 ms) reqId=9f2c1a...
    body: { "email": "user@example.com", "password": "[REDACTED]" }
```
Production output: one JSON object per line, without `query` and `body`.

## Options

`createLogger(options)`

| Option | Type | Default | Description |
|---|---|---|---|
| `level` | pino level | `'info'` | Minimum level to log |
| `pretty` | `boolean` | `false` | Colored, readable output via `pino-pretty` |
| `redactKeys` | `string[]` | `[]` | Extra keys to redact, on top of `DEFAULT_REDACT_KEYS` |

`createRequestLogger(options)`

| Option | Type | Default | Description |
|---|---|---|---|
| `logger` | `Logger` | – (required) | From `createLogger` |
| `logPayloads` | `boolean` | `false` | Log `query` and `body` (still redacted) |
| `trustIncomingRequestId` | `boolean` | `false` | Reuse a valid incoming ID; enable only behind a trusted proxy |
| `requestIdHeader` | `string` | `'X-Request-Id'` | Header to read and return the ID |

Log levels per response: 2xx/3xx → `info`, 4xx → `warn`, 5xx → `error`.

## Redaction limits
- Matching is by **exact key name** (`password`, not `Password` or `userPassword`), up to 3 levels deep.
  Add your own keys with `redactKeys`.
- Redaction does not look inside strings: `logger.info('pw=' + password)` leaks. Always log objects, not concatenated strings.
- The URL path is logged without its query string, because query values can hold secrets.

## How to reuse
Copy `src/lib/logger/` and install the packages. In an ESM project, import with the `.js` extension; in CommonJS
(e.g. NestJS) drop the extension. `core.ts` works without Express (scripts, workers, other frameworks).
