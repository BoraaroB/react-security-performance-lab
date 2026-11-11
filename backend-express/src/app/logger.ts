// Glue: the app-wide logger, configured from `config`. Import it wherever the app needs to log outside a request.
import { createLogger } from '../lib/logger/index.js';
import { config } from './config.js';

export const logger = createLogger({
  level: config.logLevel,
  pretty: !config.isProduction,
  // Safety net: a `User` object holds the bcrypt hash. Code should log only public fields, but if a whole user ever
  // ends up in a log line, the hash must not (a leaked hash can be attacked offline).
  redactKeys: ['passwordHash'],
});
