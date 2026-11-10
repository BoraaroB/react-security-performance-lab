// Per-client request limits that answer 429 RATE_LIMITED: against brute force, scraping, and small floods.
export { rateLimit, type RateLimitOptions } from './express.js';
