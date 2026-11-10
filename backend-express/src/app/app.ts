import express from 'express';
import { healthRouter } from './routes/health.js';

/**
 * Builds the Express app without starting it, so tests can use the app without opening a port.
 * Middleware order matters; later steps add the logger, security headers, CORS, rate limits, and error handling here.
 */
export function createApp() {
  const app = express();

  // Don't advertise "X-Powered-By: Express"; it helps attackers pick known exploits.
  app.disable('x-powered-by');

  app.use(express.json());

  app.use('/api/health', healthRouter);

  return app;
}
