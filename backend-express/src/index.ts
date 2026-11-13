import { createApp } from './app/app.js';
import { config } from './app/config.js';
import { logger } from './app/logger.js';
import { createUsersRepository } from './app/repositories/users.repository.js';
import { encryptor, passwords } from './app/security.js';
import { seedDemoAccounts } from './app/seed.js';
import { createStore } from './app/store.js';
import { registerGracefulShutdown } from './lib/graceful-shutdown/index.js';
import { createMemoryRefreshTokenStore, createRefreshTokenService } from './lib/refresh-tokens/index.js';

const store = createStore();
const users = createUsersRepository(store, encryptor);
// In memory, like the users: every session ends on restart. Defaults: 7 days per token, 30 days per login.
const refreshTokenStore = createMemoryRefreshTokenStore();
const refreshTokens = createRefreshTokenService({ store: refreshTokenStore });

if (config.seedDemoAccounts) {
  const created = await seedDemoAccounts(users, passwords);
  // Loud in production on purpose: someone turned on accounts whose passwords everyone knows.
  if (config.isProduction) logger.warn({ accounts: created }, 'Seeded demo accounts with PUBLIC passwords');
  else logger.info({ accounts: created }, 'Seeded demo accounts');
}

const app = createApp({ users, refreshTokens });

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
