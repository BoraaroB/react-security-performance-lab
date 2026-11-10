// Glue: the app-wide logger, configured from `config`. Import it wherever the app needs to log outside a request.
import { createLogger } from '../lib/logger/index.js';
import { config } from './config.js';

export const logger = createLogger({ level: config.logLevel, pretty: !config.isProduction });
