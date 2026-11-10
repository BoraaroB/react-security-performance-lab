import express from 'express';
import { errorHandler, notFoundHandler } from '../lib/errors/index.js';
import { createRequestLogger } from '../lib/logger/index.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { demoRouter } from './routes/demo.js';
import { healthRouter } from './routes/health.js';

/**
 * Builds the Express app without starting it, so tests can use the app without opening a port.
 * Middleware order matters; later steps add security headers, CORS, and rate limits here.
 */
export function createApp() {
  const app = express();

  // Don't advertise "X-Powered-By: Express"; it helps attackers pick known exploits.
  app.disable('x-powered-by');

  // First, so every request (even one that later fails body parsing) gets a request ID and a log line.
  // Payloads are logged only outside production: they may contain personal data.
  app.use(createRequestLogger({ logger, logPayloads: !config.isProduction }));

  app.use(express.json());

  app.use('/api/health', healthRouter);
  if (config.enableDemoRoutes) app.use('/api/demo', demoRouter);

  // Must come after all routes: 404 for anything unmatched, then one handler that turns every error into JSON.
  app.use(notFoundHandler());
  app.use(errorHandler());

  return app;
}
