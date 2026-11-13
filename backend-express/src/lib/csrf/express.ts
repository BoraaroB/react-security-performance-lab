/**
 * Express adapter: `protect` rejects unsafe requests (POST, PUT, PATCH, DELETE) without an allowed `Origin` and a
 * valid CSRF token; `issueToken` is the handler for `GET /csrf` that sets the cookie and returns the same token.
 * Needs `cookie-parser` before it (reads `req.cookies`).
 */
import type { CookieOptions, RequestHandler } from 'express';
import { AppError } from '../errors/index.js';
import { isAllowedOrigin, isSafeMethod, type CsrfTokenService } from './core.js';

export interface CsrfOptions {
  tokens: CsrfTokenService;
  /** Exact browser origins allowed to send unsafe requests, e.g. `https://app.example.com`. */
  allowedOrigins: readonly string[];
  /** Default `__Host-csrf`. */
  cookieName?: string;
  /** Default `X-CSRF-Token`. Add it to CORS `allowedHeaders`, or the browser blocks it. */
  headerName?: string;
}

export function createCsrfProtection(options: CsrfOptions) {
  const { tokens, allowedOrigins, cookieName = '__Host-csrf', headerName = 'X-CSRF-Token' } = options;

  // `__Host-` makes the browser accept the cookie only with `Secure`, `Path=/` and no `Domain`, so a sibling subdomain
  // (e.g. a hacked blog.example.com) cannot plant its own token: that cookie injection is the classic attack on
  // double-submit. httpOnly is fine: the frontend gets the token from the JSON body, never from the cookie.
  const cookieOptions: CookieOptions = { httpOnly: true, secure: true, sameSite: 'strict', path: '/' };

  const protect: RequestHandler = (req, _res, next) => {
    if (isSafeMethod(req.method)) return next();
    if (!isAllowedOrigin(req.headers.origin, allowedOrigins)) {
      return next(new AppError(403, 'CSRF_INVALID', 'Request origin is not allowed'));
    }
    // `req.cookies` is undefined without cookie-parser: then the check fails (closed), it never passes by mistake.
    const cookieToken: unknown = req.cookies?.[cookieName];
    if (!tokens.verify(cookieToken, req.get(headerName))) {
      return next(new AppError(403, 'CSRF_INVALID', 'Invalid or missing CSRF token'));
    }
    next();
  };

  // Reuses a still-valid cookie: a new token on every call would break the token that other tabs hold in memory
  // (their next POST would get 403). The frontend keeps the token in memory and sends it on every unsafe request.
  const issueToken: RequestHandler = (req, res) => {
    const existing: unknown = req.cookies?.[cookieName];
    const csrfToken = typeof existing === 'string' && tokens.verify(existing, existing) ? existing : tokens.create();
    res.cookie(cookieName, csrfToken, cookieOptions);
    res.json({ csrfToken });
  };

  return { protect, issueToken };
}
