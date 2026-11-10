// Security middleware for HTTP APIs: response headers (helmet) and CORS. Each export works with plain Node req/res.
export { corsPolicy, isExactOrigin, type CorsPolicyOptions } from './cors.js';
export { securityHeaders, type NodeMiddleware } from './headers.js';
