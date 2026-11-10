# PR 06: Rate limiting and `trust proxy`

## What and why
Without limits, one client can send unlimited login attempts (brute force), scrape everything, or flood the server.
This PR adds `lib/rate-limit`: per-IP counters in a time window. Over the limit → `429 RATE_LIMITED` (same JSON error
shape) + `Retry-After`. The limiter identifies clients by `req.ip`, so `trust proxy` is now set from config
(`TRUST_PROXY`, a hop count or proxy IPs, never `true`, so a client cannot fake its IP with `X-Forwarded-For`). Topic: API security.

## Changes
- `backend-express/src/lib/rate-limit/express.ts`: `rateLimit({ windowMs, limit, message?, store?, logger? })` over
  `express-rate-limit`; IETF `RateLimit` headers, 429 goes through the central error handler as `AppError`.
- `backend-express/src/lib/rate-limit/index.ts`, `README.md`: exports, usage, `trust proxy` / IPv6 / multi-instance notes.
- `backend-express/src/app/config.ts`: `TRUST_PROXY` (default `0`; `0`–`10` or a list of IPs, CIDRs ≥ /8 (IPv4) or
  ≥ /32 (IPv6), `loopback`, ...).
- `backend-express/src/app/app.ts`: `trust proxy` from config; global limit 300 requests / 15 min per IP (after CORS,
  before the body parser); CORS exposes `Retry-After`, `RateLimit`, `RateLimit-Policy`.
- `backend-express/src/app/routes/demo.ts`: `GET /api/demo/rate-limit`, strict limit of 5 requests per minute.
- Both limiters get the app's pino `logger`, so the library's setup warnings are normal log lines.
- `backend-express/.env.example`: documents `TRUST_PROXY`.
- `backend-express/package.json`: `express-rate-limit@^8.7.1`.

## How to test
```bash
cd backend-express && npm run dev
for i in 1 2 3 4 5 6; do curl -s -o /dev/null -w "%{http_code} " localhost:4000/api/demo/rate-limit; done
# 200 200 200 200 200 429
curl -si localhost:4000/api/demo/rate-limit | grep -iE '^(HTTP|retry-after|ratelimit)|RATE_LIMITED'
# 429, Retry-After: <seconds>, RateLimit: "5-in-1min"; r=0; ..., {"error":{"code":"RATE_LIMITED",...}}
curl -s -o /dev/null -w "%{http_code}\n" -H 'X-Forwarded-For: 1.2.3.4' localhost:4000/api/demo/rate-limit
# 429: without a trusted proxy the header is ignored, a fake IP does not reset the limit
TRUST_PROXY=true npx tsx src/index.ts; echo $?   # → "TRUST_PROXY: use a hop count (0-10) or ...", 1
```

## How to reuse in another project
Copy `src/lib/rate-limit/` and `src/lib/errors/`, run `npm i express-rate-limit`:
```ts
import { rateLimit } from './lib/rate-limit/index.js';
app.set('trust proxy', 1); // only if exactly one reverse proxy is in front of the app
app.use(rateLimit({ windowMs: 15 * 60_000, limit: 300 }));
router.post('/login', rateLimit({ windowMs: 15 * 60_000, limit: 5 }), loginHandler);
```

## Verification
- `npm run typecheck` and `npm run build`: no errors.
- Smoke test (`tsx src/index.ts` + curl): demo route 5 × 200, then 429 with `Retry-After: 60`, both `RateLimit` policies,
  CORS headers, and the JSON error with `requestId`; log has `WARN RATE_LIMITED` with the same `reqId`. `/api/health` still
  200 (global counter only). Preflight is not counted and exposes the new headers. `X-Forwarded-For` with `TRUST_PROXY=0` → still 429.
- `TRUST_PROXY=1`: client `5.5.5.5` → 5 × 200 then 429; client `6.6.6.6` → 200; `9.9.9.9, 5.5.5.5` (fake IP in front) → 429.
- `TRUST_PROXY` = `true`, `99`, `10.0.0.1/33`, `abc`, empty, `0.0.0.0/0`, `128.0.0.0/1`, `::/0` → startup error;
  `loopback, 10.0.0.0/8, ::1` and `192.168.0.0/16,fd12::/48,uniquelocal` → accepted.
- After the review fixes: the first request with `X-Forwarded-For` (`TRUST_PROXY=0`) → 200, plus one pino `ERROR` line with
  `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`; the 5 × 200 → 429 flow is unchanged.
- `express-rate-limit` is locked to 8.7.1 (published 2026-10-06): 8.7.4 was one day old, too new to trust (supply-chain risk).

## Review
Both reviewers checked `node_modules/express-rate-limit` (8.7.1) and confirmed: `Retry-After` is set before the handler,
IPv6 is grouped by /56, the draft-8 `pk` is a hash (not the raw IP), the two limiters count separately, middleware order
is right, the default `0` → `false` trusts no proxy, and the module imports only `lib/errors`.
- **Fixed** (both): `TRUST_PROXY=0.0.0.0/0` (or `0.0.0.0/1,128.0.0.0/1`) passed validation and means the same as `true`.
  CIDR prefixes must now be ≥ /8 (IPv4) and ≥ /32 (IPv6); wider private ranges use the names (`uniquelocal`, ...).
  `/0` would also have crashed Express at startup with a raw `TypeError`.
- **Fixed** (code-reviewer): the library's setup warnings went to `console.error`. New `logger` option passes them to pino.
  While testing it, a real bug showed up and was fixed: pino's methods lose `this` when passed as bare functions, so the
  first `X-Forwarded-For` request became a 500. The adapter now calls `logger.warn(...)` / `logger.error(...)` as methods.
- **Fixed** (code-reviewer): README notes that a custom store needs one instance (unique prefix) per limiter.
- **Fixed** (code-reviewer): plan row 06 now says `TRUST_PROXY` and "strict auth limiter: step 09".
- **Fixed** (code-reviewer): "a normal user never gets near it" ignored shared IPs (office, CGNAT). Comment and README reworded.
- **Fixed** (code-reviewer): the IPv6 /56 comment was glued to the `handler` comment; split.
- Not changed (security-reviewer note): a hop count larger than the real number of proxies is spoofable too; the
  README and `.env.example` already say to use the exact number.

## Interview questions
1. **Why must `trust proxy` never be `true`?** Express would take the left-most `X-Forwarded-For` value as `req.ip`, and
   the client writes that value itself. Every request could claim a new IP and get a fresh limit. Trust exactly the number of
   proxies you run (or their IPs): then only the address your own proxy appended is used.
2. **What is the limit of an in-memory rate limiter?** The counters live in one process: with 3 instances a client gets
   3× the limit, and a restart resets them. Production with several instances needs a shared store (Redis).
3. **Global vs. per-route limits?** The global limit is generous and stops floods. Sensitive routes (login, register,
   password reset) get a much stricter one, because each attempt is a password guess and costs a bcrypt hash.
