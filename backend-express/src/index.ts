import { createApp } from './app/app.js';
import { config } from './app/config.js';
import { registerGracefulShutdown } from './lib/graceful-shutdown/index.js';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`Express API (${config.env}) listening on http://localhost:${config.port}/api`);
});

registerGracefulShutdown(server);
