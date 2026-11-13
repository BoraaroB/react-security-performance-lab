// CSRF protection for cookie-based routes: an `Origin` allowlist plus a signed double-submit token, so another site
// cannot make the user's browser log in, refresh, log out, or change data with the user's cookies.
export {
  createCsrfTokenService,
  CsrfConfigError,
  isAllowedOrigin,
  isSafeMethod,
  type CsrfTokenOptions,
  type CsrfTokenService,
} from './core.js';
export { createCsrfProtection, type CsrfOptions } from './express.js';
