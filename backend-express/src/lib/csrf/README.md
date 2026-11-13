# csrf

Stops cross-site request forgery on cookie-based routes: every POST, PUT, PATCH and DELETE needs an allowed `Origin`
header and a signed CSRF token sent twice (cookie + header). Another site can make the browser send our cookies, but
it cannot set our `Origin`, read our token, or add a custom header without passing CORS.

## Dependencies
- npm: `express@^5`, `cookie-parser@^1` (must run before `protect`)
- lib: `errors` (403 `CSRF_INVALID` is an `AppError`)

## Usage

```ts
import cookieParser from 'cookie-parser';
import { createCsrfProtection, createCsrfTokenService } from './lib/csrf/index.js';

const csrf = createCsrfProtection({
  tokens: createCsrfTokenService({ secret: process.env.CSRF_SECRET! }),
  allowedOrigins: ['https://app.example.com'],
});

app.use(cookieParser());
app.use(csrf.protect); // skips GET/HEAD/OPTIONS
app.get('/api/auth/csrf', csrf.issueToken); // → { csrfToken } + __Host-csrf cookie
// Client: send `X-CSRF-Token: <csrfToken>` (and `credentials: 'include'`) on every unsafe request.
// Allow that header in CORS: allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'].
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `secret` (`createCsrfTokenService`) | `string` | – | HMAC key, at least 32 characters, its own value |
| `tokens` | `CsrfTokenService` | – | From `createCsrfTokenService` |
| `allowedOrigins` | `string[]` | – | Exact origins (no trailing slash). Usually the same list as CORS |
| `cookieName` | `string` | `__Host-csrf` | Keep the `__Host-` prefix (needs HTTPS; browsers treat `localhost` as secure) |
| `headerName` | `string` | `X-CSRF-Token` | Must be in the CORS `allowedHeaders` |

## Notes
- **Two checks, both required.** `Origin` is set by the browser and cannot be faked by a page. The token is the
  second layer, in case the `Origin` allowlist is ever misconfigured. A missing `Origin` or `null` is rejected, so
  non-browser clients (curl) must send one; native apps should use routes without cookies.
- **Unbound variant of OWASP's signed double submit.** The token is `random.HMAC(secret, random)`. Equal cookie and
  header prove the request came from our page (another site can neither read the token nor set the header).
  The signature only rejects values the server did not create.
- **Not bound to a session.** Any valid token pair works for any user, and anyone can get one from `GET /csrf`, so
  the signature does NOT stop an attacker who can write cookies from planting a pair they know. The `__Host-` cookie
  prefix stops that (a sibling subdomain or a plain-HTTP response cannot set it). OWASP's version puts a session ID
  inside the HMAC, which would stop planting too.
- **One token per browser.** `issueToken` returns the token from a still-valid cookie instead of a new one, so a
  second tab does not break the first tab's token. A client should still fetch a new token once after a 403.
- **Only for cookie auth.** A route that reads only `Authorization: Bearer` is not open to CSRF (the browser never
  adds that header on its own), but checking every unsafe request is simpler than remembering which ones are safe.

## How to reuse
Copy `src/lib/csrf/` and `src/lib/errors/`. `core.ts` has no framework code (use it from a Nest guard). In an ESM
project, import with the `.js` extension; in CommonJS (e.g. NestJS) drop it.
