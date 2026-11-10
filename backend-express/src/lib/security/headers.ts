/**
 * Security headers for a JSON API, built on helmet.
 *
 * Why: browsers apply these headers to every response. They stop a response from being run as a script or HTML page,
 * framed by another site (clickjacking), read by other sites' pages, or fetched over plain HTTP after the first visit.
 * helmet's defaults are made for HTML websites; an API never serves HTML, so the policy below is stricter.
 *
 * helmet middleware uses plain Node `req`/`res`, so the same function works in Express, NestJS, and Connect.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import helmet from 'helmet';

export type NodeMiddleware = (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => void;

export function securityHeaders(): NodeMiddleware {
  return helmet({
    // An API response should never load anything. If an attacker gets HTML into a response and a browser renders it,
    // `default-src 'none'` blocks every script, style, and image. `frame-ancestors 'none'` forbids framing.
    contentSecurityPolicy: {
      useDefaults: false,
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
    // Same rule for old browsers that don't know `frame-ancestors` (helmet's default is SAMEORIGIN).
    xFrameOptions: { action: 'deny' },
    // The options below are helmet's defaults too. They are written out because they matter most for an API.
    // HSTS: "use only HTTPS for this host for a year". Browsers ignore it over plain HTTP (localhost), so dev still works.
    strictTransportSecurity: { maxAge: 31_536_000, includeSubDomains: true },
    // nosniff: the browser must trust Content-Type (JSON) and never guess "this looks like a script".
    xContentTypeOptions: true,
    // Other sites may not embed our responses with <img>/<script> tags. Normal CORS requests are not affected.
    crossOriginResourcePolicy: { policy: 'same-origin' },
    // Don't leak our URLs (they may hold IDs or tokens) to other sites in the Referer header.
    referrerPolicy: { policy: 'no-referrer' },
    // Sends "X-XSS-Protection: 0": the old browser XSS filter could itself be abused to leak data. CSP replaces it.
    xXssProtection: true,
    // Removes "X-Powered-By: Express", which helps attackers pick known exploits.
    xPoweredBy: true,
  });
}
