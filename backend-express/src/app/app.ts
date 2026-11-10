import express from 'express';
import { createRequestLogger } from '../lib/logger/index.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { healthRouter } from './routes/health.js';

/**
 * Builds the Express app without starting it, so tests can use the app without opening a port.
 * Middleware order matters; later steps add security headers, CORS, rate limits, and error handling here.
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

  return app;
}
