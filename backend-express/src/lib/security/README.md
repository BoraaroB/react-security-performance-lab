# security

HTTP security middleware for a JSON API. `securityHeaders()` sets response headers (via helmet) that tell the browser
not to run, frame, sniff, or embed API responses, and to use only HTTPS. Step 05b adds CORS here.

## Dependencies
- npm: `helmet@^8`
- lib: none

## Usage

```ts
import { securityHeaders } from './lib/security/index.js';

app.use(securityHeaders()); // early, so every response (404 and errors too) gets the headers
```

NestJS: `app.use(securityHeaders())` in `main.ts`. helmet uses plain Node `req`/`res`, so no adapter is needed.

## Headers it sends

| Header | Value | Protects against |
|---|---|---|
| `Content-Security-Policy` | `default-src 'none';frame-ancestors 'none'` | a response rendered as HTML running scripts; framing |
| `X-Frame-Options` | `DENY` | clickjacking (old browsers) |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | downgrade to HTTP, cookie theft on public Wi-Fi |
| `X-Content-Type-Options` | `nosniff` | the browser treating JSON as a script |
| `Cross-Origin-Resource-Policy` | `same-origin` | other sites embedding responses with `<img>`/`<script>` |
| `Referrer-Policy` | `no-referrer` | leaking URLs to other sites |
| `X-XSS-Protection` | `0` | the buggy old XSS filter |

helmet also sends `Cross-Origin-Opener-Policy`, `Origin-Agent-Cluster`, `X-DNS-Prefetch-Control`, `X-Download-Options`,
and `X-Permitted-Cross-Domain-Policies`, and removes `X-Powered-By`.

## Notes
- This policy is for an API only. A server that returns HTML pages needs a CSP that allows its own scripts and styles
  (helmet's defaults are a good start).
- HSTS with `includeSubDomains` affects every subdomain of the host. Check that all of them support HTTPS before production.

## How to reuse
Copy `src/lib/security/` and install `helmet`. In an ESM project, import with the `.js` extension;
in CommonJS (e.g. NestJS) drop it.
