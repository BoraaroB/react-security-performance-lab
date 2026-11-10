import { createApp } from './app/app.js';
import { config } from './app/config.js';
import { logger } from './app/logger.js';
import { registerGracefulShutdown } from './lib/graceful-shutdown/index.js';

const app = createApp();

// Express 5 passes listen errors (e.g. EADDRINUSE: port already taken) to this callback instead of throwing them.
const server = app.listen(config.port, (error) => {
  if (error) {
    logger.fatal({ err: error }, 'Server failed to start');
    process.exit(1);
  }
  logger.info(`Express API (${config.env}) listening on http://localhost:${config.port}/api`);
});

registerGracefulShutdown(server, {
  // pino takes (object, message), so the error goes under `err` and gets serialized with its stack.
  logger: {
    info: (message) => logger.info(message),
    error: (message, err) => logger.error({ err }, message),
    fatal: (message, err) => logger.fatal({ err }, message),
  },
});
