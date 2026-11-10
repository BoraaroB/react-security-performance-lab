# security

HTTP security middleware for a JSON API. `securityHeaders()` sets response headers (via helmet) that tell the browser
not to run, frame, sniff, or embed API responses, and to use only HTTPS. `corsPolicy()` lets only an exact list of
browser origins read API responses (with cookies, if enabled).

## Dependencies
- npm: `helmet@^8`, `cors@^2.8` (+ `@types/cors` as a dev dependency)
- lib: none

## Usage

```ts
import { corsPolicy, securityHeaders } from './lib/security/index.js';

// Early, before the body parser and routes, so every response (404 and errors too) gets the headers.
app.use(securityHeaders());
app.use(corsPolicy({ allowedOrigins: ['https://app.example.com'], credentials: true }));
```

NestJS: `app.use(...)` the same two calls in `main.ts` (instead of `app.enableCors()`). Both use plain Node `req`/`res`,
so no adapter is needed.

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

## `corsPolicy` options

| Option | Type | Default | Description |
|---|---|---|---|
| `allowedOrigins` | `string[]` | required | Exact origins (`https://host[:port]`). Invalid entries throw at startup. `[]` = no cross-origin access |
| `credentials` | `boolean` | `false` | Send `Access-Control-Allow-Credentials: true`, so the browser sends and accepts cookies |
| `allowedHeaders` | `string[]` | `Content-Type`, `Authorization` | Request headers the page may send |
| `exposedHeaders` | `string[]` | `X-Request-Id` | Response headers the page's JavaScript may read |

Preflight answers are cached by the browser for 10 minutes (`Access-Control-Max-Age: 600`).

## Notes
- CORS only decides whether the **browser** lets a page **read** the response. A simple request (e.g. a form POST)
  from a disallowed origin is not preflighted, so it still reaches your handlers; `curl` ignores CORS. Protect writes with CSRF checks.
- Use only `https://` origins in production: a script injected into a plain-HTTP page could read credentialed responses.
- Origins are compared as exact strings: `https://app.example.com/` (trailing slash) or `HTTPS://App.example.com`
  would never match, so they are rejected at startup. `*`, `null`, and regexes are not supported on purpose.
- This policy is for an API only. A server that returns HTML pages needs a CSP that allows its own scripts and styles
  (helmet's defaults are a good start).
- HSTS with `includeSubDomains` affects every subdomain of the host. Check that all of them support HTTPS before production.

## How to reuse
Copy `src/lib/security/` and install `helmet`. In an ESM project, import with the `.js` extension;
in CommonJS (e.g. NestJS) drop it.
