# PR 05a: Security headers (helmet) and a body size limit

## What and why
Browsers obey security headers on every response. This PR adds helmet with a policy made for a JSON API:
a strict CSP (`default-src 'none'`), no framing, HTTPS only (HSTS), no MIME sniffing, no embedding by other sites.
It also sets an explicit JSON body limit (32 kb instead of the 100 kb default), so a client cannot make the server
read and parse huge bodies. Step 05 was split: CORS comes in 05b. Topics: XSS (defense in depth) and API security.

## Changes
- `backend-express/src/lib/security/headers.ts`: `securityHeaders()`, helmet with an API policy; every option has a "why" comment.
- `backend-express/src/lib/security/index.ts`, `README.md`: public API and a table "header → what it protects against".
- `backend-express/src/app/app.ts`: `securityHeaders()` right after the request logger; `express.json({ limit: '32kb' })`.
- `backend-express/package.json`: new dependency `helmet@^8`.

## How to test
```bash
cd backend-express && npm run dev
curl -i localhost:4000/api/health
# Content-Security-Policy: default-src 'none';frame-ancestors 'none'
# Strict-Transport-Security: max-age=31536000; includeSubDomains
# X-Content-Type-Options: nosniff, X-Frame-Options: DENY, no X-Powered-By
curl -i localhost:4000/api/nope      # 404, same headers
head -c 40000 /dev/zero | tr '\0' a | awk '{printf "{\"name\":\"%s\"}", $0}' \
  | curl -si -X POST localhost:4000/api/demo/validation -H 'content-type: application/json' --data-binary @-
# HTTP/1.1 413 Payload Too Large  {"error":{"code":"PAYLOAD_TOO_LARGE",...}}
```

## How to reuse in another project
Copy `src/lib/security/`, run `npm i helmet`. Works in Express and NestJS (helmet uses plain Node `req`/`res`):
```ts
import { securityHeaders } from './lib/security/index.js';
app.use(securityHeaders());               // early, before routes and error handlers
app.use(express.json({ limit: '32kb' })); // size it to your biggest real request
```

## Verification
- `npm run typecheck` and `npm run build`: no errors.
- Smoke test (`tsx src/index.ts` + curl): all headers on 200, 404 and 413 responses; 40 kb body → 413
  `PAYLOAD_TOO_LARGE` (with `Content-Length` and with `Transfer-Encoding: chunked`); 20 kb body → 200.

## Review
- **security-reviewer: no findings.** It checked helmet, body-parser and raw-body in `node_modules`. The CSP is exactly
  `default-src 'none';frame-ancestors 'none'`. All responses carry the headers (404, 413, 400, 500). The limit holds for
  `Content-Length`, chunked and gzip bodies. CORP `same-origin` will not break CORS `fetch` in 05b (CORP applies only to `no-cors` requests).
- **Fixed** (code-reviewer): the comment in `app.ts` and interview Q3 claimed a too-big body is never read. body-parser
  still reads the rest and throws it away (it only skips buffering and parsing). Both texts now say that.
- **Fixed** (code-reviewer): the README showed the CSP with a space after `;`; helmet sends it without one.
- **Postponed** (code-reviewer): the 32 kb limit assumes posts are at most 10,000 characters, a number that is not in the plan yet.
  Added to "Known gaps" in `docs/PROGRESS.md` for step 12.

## Interview questions
1. **Why `default-src 'none'` on an API?** The API returns only JSON, so it never needs to load scripts or styles.
   If a browser is ever tricked into rendering a response as HTML (reflected input, wrong Content-Type), nothing runs.
2. **What does HSTS do, and why is it ignored on `http://localhost`?** It tells the browser to use only HTTPS for that host
   for `max-age` seconds, which stops downgrade attacks. Browsers accept it only over HTTPS; otherwise a network attacker could inject it.
3. **Why limit the body size?** Parsing JSON costs CPU and memory. Without a small limit, a few clients sending big bodies
   can exhaust the server (DoS). Bytes past the limit are never kept in memory or parsed (the rest is read and discarded).
   Huge or slow uploads as a whole are stopped by timeouts or a reverse proxy, not by this setting.
