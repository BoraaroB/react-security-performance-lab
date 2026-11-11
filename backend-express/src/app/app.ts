import express from 'express';
import { errorHandler, notFoundHandler } from '../lib/errors/index.js';
import { createRequestLogger } from '../lib/logger/index.js';
import { rateLimit } from '../lib/rate-limit/index.js';
import { corsPolicy, securityHeaders } from '../lib/security/index.js';
import { config } from './config.js';
import { logger } from './logger.js';
import type { UsersRepository } from './repositories/users.repository.js';
import { createAuthRouter } from './routes/auth.routes.js';
import { demoRouter } from './routes/demo.js';
import { healthRouter } from './routes/health.js';
import { accessTokens, passwords } from './security.js';
import { createAuthService } from './services/auth.service.js';

export interface AppDeps {
  users: UsersRepository;
}

/**
 * Builds the Express app without starting it, so tests can use the app without opening a port.
 * The repository comes in as a parameter (dependency injection), so a test can pass a fresh, empty store.
 * Middleware order matters.
 */
export function createApp({ users }: AppDeps) {
  const app = express();

  // Don't advertise "X-Powered-By: Express"; it helps attackers pick known exploits.
  app.disable('x-powered-by');

  // Decides what `req.ip` is (the rate limiter's key): a hop count or proxy IPs from config, never `true`.
  app.set('trust proxy', config.trustProxy);

  // First, so every request (even one that later fails body parsing) gets a request ID and a log line.
  // Payloads are logged only outside production: they may contain personal data.
  app.use(createRequestLogger({ logger, logPayloads: !config.isProduction }));

  // Right after the logger, before anything that can fail: 404s and error responses get the headers too.
  app.use(securityHeaders());

  // Before the body parser and routes: preflight (OPTIONS) requests are answered here, and error responses (400, 404,
  // 413, 500) also carry CORS headers, so the frontend can read the error JSON. Credentials: the refresh-token cookie.
  // Exposed headers: the frontend's JavaScript may read the request ID and the rate-limit headers (when to retry).
  app.use(
    corsPolicy({
      allowedOrigins: config.corsOrigins,
      credentials: true,
      exposedHeaders: ['X-Request-Id', 'Retry-After', 'RateLimit', 'RateLimit-Policy'],
    }),
  );

  // Global limit per client IP: generous, it only stops floods and scrapers (users behind one shared IP, e.g. an
  // office or a mobile carrier, share it). After CORS, so preflights are not counted; before the body parser, so
  // blocked requests are never parsed. Sensitive routes (e.g. login) add their own, much stricter limiter.
  app.use(rateLimit({ windowMs: 15 * 60_000, limit: 300, logger }));

  // Explicit limit instead of the 100 kb default: bytes past 32 kb are never buffered in memory or parsed, and the
  // client gets 413. (The rest of the body is still read and thrown away; slow or huge uploads are stopped by timeouts
  // or a reverse proxy, not by this.) The biggest planned request, a post (10,000 characters, up to ~30 kb in UTF-8
  // with non-Latin text), still fits.
  app.use(express.json({ limit: '32kb' }));

  app.use('/api/health', healthRouter);
  app.use('/api/auth', createAuthRouter(createAuthService({ users, passwords, accessTokens })));
  if (config.enableDemoRoutes) app.use('/api/demo', demoRouter);

  // Must come after all routes: 404 for anything unmatched, then one handler that turns every error into JSON.
  app.use(notFoundHandler());
  app.use(errorHandler());

  return app;
}
