# rate-limit

Limits how many requests one client (IP address) may send in a time window. Over the limit, the client gets
`429 RATE_LIMITED` with a `Retry-After` header. This slows down password guessing, scraping, and small floods.

## Dependencies
- npm: `express-rate-limit@^8`, `express@^5`
- lib: `errors` (the 429 is an `AppError`, so the central error handler formats and logs it)

## Usage

```ts
import { rateLimit } from './lib/rate-limit/index.js';

// Behind ONE reverse proxy (nginx, a load balancer). Never `true` (see Notes).
app.set('trust proxy', 1);

// Global: generous, only stops floods. Before the body parser, so blocked requests are not parsed.
app.use(rateLimit({ windowMs: 15 * 60_000, limit: 300, logger }));

// Strict, on one route: e.g. 5 login attempts per 15 minutes.
router.post('/login', rateLimit({ windowMs: 15 * 60_000, limit: 5 }), loginHandler);
```

A 429 response:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 42
RateLimit-Policy: "5-in-1min"; q=5; w=60; pk=:...:
RateLimit: "5-in-1min"; r=0; t=42

{ "error": { "code": "RATE_LIMITED", "message": "Too many requests, please try again later.", "requestId": "..." } }
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `windowMs` | `number` | required | Length of the time window in milliseconds |
| `limit` | `number` | required | Requests allowed per client per window |
| `message` | `string` | `Too many requests, please try again later.` | Message in the 429 response |
| `store` | `Store` | in memory | Where hit counts live, e.g. a Redis store |
| `logger` | `{ warn, error }` (pino-style `(obj, msg)`) | console | Logs the library's one-time setup checks |

Each `rateLimit()` call has its own counters, so a global and a route limiter are counted separately.
With a custom store, create one store instance per limiter (with a unique prefix), or the counters get mixed.

## Notes
- **`trust proxy`:** the client is `req.ip`. Without a proxy, that is the socket address (correct). Behind a proxy,
  every request comes from the proxy's IP, so all users would share one limit; set `trust proxy` to the number of
  proxies or their IPs. Never `true`: then Express believes the left-most `X-Forwarded-For` value, which the client
  writes itself, so every request could claim a new IP. A very wide CIDR (`0.0.0.0/0`) is the same as `true`.
  express-rate-limit checks the **first** request each limiter sees and logs an error (to `logger`) if `trust proxy`
  is `true`, or if that request has `X-Forwarded-For` while `trust proxy` is off. It is a one-time setup check,
  not an alarm for every request.
- **IPv6:** clients are grouped by their /56 block, because one user often has a whole block of addresses.
- **Shared IPs:** an office, a university, or a mobile carrier (CGNAT) can put many users behind one IP, and they
  share one limit. Keep global limits generous.
- **Multiple instances:** the memory store counts per process. With 3 instances a client gets 3× the limit, and a
  restart resets all counters. Use a shared store (e.g. `rate-limit-redis`) for more than one instance.
- Not full DoS protection: a big attack must be stopped before Node (CDN, reverse proxy).
- CORS: add `Retry-After` and `RateLimit` to `exposedHeaders`, or the frontend's JavaScript cannot read them.
- NestJS has its own limiter (`@nestjs/throttler`); this module is for Express.

## How to reuse
Copy `src/lib/rate-limit/` and `src/lib/errors/`, and install `express-rate-limit`. In an ESM project, import with
the `.js` extension; in CommonJS drop it.
