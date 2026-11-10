# graceful-shutdown

Stops a Node HTTP server without cutting off requests that are still running. On SIGTERM/SIGINT it stops
accepting new connections, waits for in-flight requests, runs your cleanup, then exits, or force-exits after a timeout.

It also handles crashes. On `uncaughtException` or `unhandledRejection` it logs the error as `fatal` and shuts down
the same way, but exits with code **1**. A process in an unknown state must not keep serving, and a non-zero exit code
is what makes Docker/systemd/Kubernetes restart it and alerts fire.

## Dependencies
- npm: none (works with any `node:http` server: Express, Fastify, plain Node)
- lib: none

## Usage

```ts
import express from 'express';
import { registerGracefulShutdown } from './lib/graceful-shutdown/index.js';

const app = express();
const server = app.listen(4000);

registerGracefulShutdown(server, {
  timeoutMs: 10_000,
  onShutdown: async () => {
    await db.close(); // anything that must be closed cleanly
  },
});
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `timeoutMs` | `number` | `10000` | Force exit after this many ms |
| `signals` | `NodeJS.Signals[]` | `['SIGINT', 'SIGTERM']` | Signals that trigger shutdown |
| `handleProcessErrors` | `boolean` | `true` | Handle `uncaughtException` / `unhandledRejection` (log as fatal, exit 1) |
| `onShutdown` | `() => Promise<void> \| void` | – | Cleanup after the server stops accepting requests |
| `logger` | `{ info, error, fatal? }` | `console` | Pass your app logger (e.g. pino). `fatal` falls back to `error` |

Returns `{ shutdown(reason, exitCode = 0) }` to trigger it manually.

## Exit codes
| Trigger | Exit code |
|---|---|
| SIGINT / SIGTERM, clean finish | `0` |
| `uncaughtException` / `unhandledRejection` | `1` (even if a crash happens while a SIGTERM shutdown is already running) |
| Shutdown timed out, or `server.close()` / `onShutdown` failed | `1` |

Note: a listener for `unhandledRejection` turns off Node's default crash. If you turn `handleProcessErrors` off,
do not add your own listener that only logs: the process would keep running in a broken state.

## How to reuse
Copy `src/lib/graceful-shutdown/`. In an ESM project, import with the `.js` extension.
Keep `timeoutMs` below your platform's kill timeout (Docker: 10 s, Kubernetes: `terminationGracePeriodSeconds`, default 30 s).
