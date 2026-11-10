# PR 05b: CORS allowlist with credentials

## What and why
The React app (`localhost:5173`) and the API (`localhost:4000`) are different origins, so by default the browser does not
let the page read API responses. This PR adds `corsPolicy()` to `lib/security`: only an exact list of origins
(`CORS_ORIGINS`) may read responses, with cookies allowed (`credentials: true`, needed for the refresh token in step 10).
It never reflects any origin and never uses `*`. Topics: API security, CSRF/XSS background (same-origin policy).

## Changes
- `backend-express/src/lib/security/cors.ts`: `corsPolicy({ allowedOrigins, credentials, allowedHeaders, exposedHeaders })`
  over the `cors` package; `isExactOrigin()` rejects `*`, paths, trailing slashes, and non-HTTP schemes at startup.
- `backend-express/src/lib/security/index.ts`, `README.md`: new exports, options table, "CORS is not access control" note.
- `backend-express/src/app/config.ts`: `CORS_ORIGINS` (comma-separated, validated, not empty, https only in production).
  Default: `http://localhost:5173` in dev, none in production.
- `backend-express/src/app/app.ts`: `corsPolicy` after `securityHeaders`, before the body parser, so errors carry CORS headers too.
- `backend-express/.env.example`: documents `CORS_ORIGINS`.
- `backend-express/package.json`: `cors@^2.8`, dev `@types/cors@^2.8`.

## How to test
```bash
cd backend-express && npm run dev
curl -si localhost:4000/api/health -H 'Origin: http://localhost:5173' | grep -i '^access-control-allow-origin'
# Access-Control-Allow-Origin: http://localhost:5173
curl -si localhost:4000/api/health -H 'Origin: https://evil.example' | grep -i '^access-control-allow-origin'
# (nothing): the browser blocks the page from reading the response
curl -si -X OPTIONS localhost:4000/api/demo/validation -H 'Origin: http://localhost:5173' \
  -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: content-type'
# 204, Allow-Methods, Allow-Headers: Content-Type,Authorization, Max-Age: 600
CORS_ORIGINS='http://localhost:5173/' npx tsx src/index.ts; echo $?   # → "CORS_ORIGINS.0: must be an origin like ...", 1
```

## How to reuse in another project
Copy `src/lib/security/`, run `npm i helmet cors && npm i -D @types/cors`. Works in Express and NestJS (`app.use` in `main.ts`):
```ts
import { corsPolicy, securityHeaders } from './lib/security/index.js';
app.use(securityHeaders());
app.use(corsPolicy({ allowedOrigins: ['https://app.example.com'], credentials: true }));
```

## Verification
- `npm run typecheck` and `npm run build`: no errors.
- Smoke test (`tsx src/index.ts` + curl): allowed origin → `Access-Control-Allow-Origin` + `Vary: Origin` on 200, 404 and 400;
  other origin or no `Origin` → no `Access-Control-Allow-Origin`; preflight allowed/disallowed → 204, header only for the allowed one;
  invalid `CORS_ORIGINS` (`http://localhost:5173/,*`) → clear startup error; `NODE_ENV=production` → no origin allowed.
- After the review fixes: `CORS_ORIGINS=''` or `' , '` → startup error; production with `http://app.example.com` → startup error;
  production with `https://app.example.com` → that origin allowed; bad origin → exit code 1.

## Review
Both reviewers checked `node_modules/cors` and confirmed: exact `===` matching (`null`, mixed case, `localhost:5173.evil.com`
get nothing), `Vary: Origin` on every response, no path to `*`, `[]` in production fails closed, errors keep CORS headers.
- **Fixed** (both): the comment said cors treats a missing or empty `origin` as `*`. Only a missing key means `*`;
  `''`/`false` skip CORS, and `true` reflects every origin. Comment and `docs/PROGRESS.md` corrected.
- **Fixed** (security-reviewer): "a disallowed request still reaches the handler" is true only for simple requests; a JSON POST
  is stopped at the preflight. Reworded in `cors.ts`, README, and interview Q1.
- **Fixed** (both): `http://` origins were accepted in production. `config.ts` now allows only `https://` in production
  (except `localhost`); the README says why.
- **Fixed** (code-reviewer): `CORS_ORIGINS=` (empty) silently meant "no origins". Now it is a startup error.
- **Fixed** (code-reviewer): the test command used `npm run dev` (watch mode never exits); it now uses `npx tsx`.

## Interview questions
1. **Does CORS protect the server?** No. It only tells the browser whether a page may read the response. A simple request
   (e.g. a form POST) is not preflighted, so it still reaches the server, and curl ignores CORS. Writes need CSRF protection (step 11).
2. **Why is "reflect any `Origin`" + `Allow-Credentials: true` dangerous?** Any website the user visits could call the API
   with the user's cookies and read private data. That is why the allowlist is exact and `*` is rejected.
3. **What is a preflight?** For non-simple requests (e.g. JSON `Content-Type`, `Authorization` header, `DELETE`), the browser
   first sends `OPTIONS` and asks which origin, methods, and headers are allowed. `Access-Control-Max-Age` caches the answer.
