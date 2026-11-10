import express from 'express';
import { errorHandler, notFoundHandler } from '../lib/errors/index.js';
import { createRequestLogger } from '../lib/logger/index.js';
import { corsPolicy, securityHeaders } from '../lib/security/index.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { demoRouter } from './routes/demo.js';
import { healthRouter } from './routes/health.js';

/**
 * Builds the Express app without starting it, so tests can use the app without opening a port.
 * Middleware order matters; later steps add rate limits here.
 */
export function createApp() {
  const app = express();

  // Don't advertise "X-Powered-By: Express"; it helps attackers pick known exploits.
  app.disable('x-powered-by');

  // First, so every request (even one that later fails body parsing) gets a request ID and a log line.
  // Payloads are logged only outside production: they may contain personal data.
  app.use(createRequestLogger({ logger, logPayloads: !config.isProduction }));

  // Right after the logger, before anything that can fail: 404s and error responses get the headers too.
  app.use(securityHeaders());

  // Before the body parser and routes: preflight (OPTIONS) requests are answered here, and error responses (400, 404,
  // 413, 500) also carry CORS headers, so the frontend can read the error JSON. Credentials: the refresh-token cookie.
  app.use(corsPolicy({ allowedOrigins: config.corsOrigins, credentials: true }));

  // Explicit limit instead of the 100 kb default: bytes past 32 kb are never buffered in memory or parsed, and the
  // client gets 413. (The rest of the body is still read and thrown away; slow or huge uploads are stopped by timeouts
  // or a reverse proxy, not by this.) The biggest planned request, a post (10,000 characters, up to ~30 kb in UTF-8
  // with non-Latin text), still fits.
  app.use(express.json({ limit: '32kb' }));

  app.use('/api/health', healthRouter);
  if (config.enableDemoRoutes) app.use('/api/demo', demoRouter);

  // Must come after all routes: 404 for anything unmatched, then one handler that turns every error into JSON.
  app.use(notFoundHandler());
  app.use(errorHandler());

  return app;
}
