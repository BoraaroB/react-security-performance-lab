/**
 * CORS for an API that a browser app on another origin calls (e.g. React on :5173, API on :4000).
 *
 * Why: browsers let a page read responses only from its own origin (same-origin policy). CORS headers relax that
 * for an exact list of trusted origins. Never reflect any `Origin` together with credentials: then any website the user
 * visits could call the API with the user's cookies and read the answer.
 *
 * CORS is not server-side access control. A simple request (e.g. a form POST) from a disallowed origin still reaches
 * the handler; the browser only hides the response from the page. Blocking unwanted writes is the job of CSRF protection.
 */
import cors from 'cors';
import type { NodeMiddleware } from './headers.js';

export type CorsPolicyOptions = {
  /** Exact origins, e.g. `https://app.example.com`. No `*`, no path, no trailing slash. */
  allowedOrigins: readonly string[];
  /** Allow cookies on cross-origin requests (`Access-Control-Allow-Credentials: true`). Default: false. */
  credentials?: boolean;
  /** Request headers the page may send. Default: `Content-Type`, `Authorization`. */
  allowedHeaders?: readonly string[];
  /** Response headers the page's JavaScript may read. Default: `X-Request-Id`. */
  exposedHeaders?: readonly string[];
};

/** True only for `http(s)://host[:port]` written exactly as a browser sends it in the `Origin` header. */
export function isExactOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.origin === value;
  } catch {
    return false;
  }
}

export function corsPolicy(options: CorsPolicyOptions): NodeMiddleware {
  // Fail at startup: `https://app.example.com/` (trailing slash) silently never matches, and `*` must never be used.
  const invalid = options.allowedOrigins.filter((origin) => !isExactOrigin(origin));
  if (invalid.length > 0) throw new Error(`Invalid CORS origin(s): ${invalid.join(', ')}`);

  return cors({
    // Always an array (even an empty one), compared by exact string. In the cors package a missing `origin` key
    // means `*`, `true` reflects every origin (dangerous with credentials), and `''`/`false` skip CORS entirely.
    // A disallowed origin gets no `Access-Control-Allow-Origin` header, so the browser blocks the response.
    origin: [...options.allowedOrigins],
    credentials: options.credentials ?? false,
    // A fixed list. Without it, cors echoes back whatever headers the browser asks for.
    allowedHeaders: [...(options.allowedHeaders ?? ['Content-Type', 'Authorization'])],
    exposedHeaders: [...(options.exposedHeaders ?? ['X-Request-Id'])],
    // The browser caches the preflight (OPTIONS) answer for 10 minutes instead of sending one before every request.
    maxAge: 600,
  });
}
