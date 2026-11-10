# graceful-shutdown

Stops a Node HTTP server without cutting off requests that are still running. On SIGTERM/SIGINT it stops
accepting new connections, waits for in-flight requests, runs your cleanup, then exits, or force-exits after a timeout.

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
| `onShutdown` | `() => Promise<void> \| void` | – | Cleanup after the server stops accepting requests |
| `logger` | `{ info, error }` | `console` | Pass your app logger (e.g. pino) |

Returns `{ shutdown(reason) }` to trigger it manually.

## How to reuse
Copy `src/lib/graceful-shutdown/`. In an ESM project, import with the `.js` extension.
Keep `timeoutMs` below your platform's kill timeout (Docker: 10 s, Kubernetes: `terminationGracePeriodSeconds`, default 30 s).
