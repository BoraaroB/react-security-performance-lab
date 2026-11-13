import cookieParser from 'cookie-parser';
import express from 'express';
import { createCsrfProtection } from '../lib/csrf/index.js';
import { errorHandler, notFoundHandler } from '../lib/errors/index.js';
import { authenticate } from '../lib/jwt/index.js';
import { createRequestLogger } from '../lib/logger/index.js';
import { rateLimit } from '../lib/rate-limit/index.js';
import type { RefreshTokenService } from '../lib/refresh-tokens/index.js';
import { corsPolicy, securityHeaders } from '../lib/security/index.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { loadCurrentUser } from './middleware/current-user.middleware.js';
import type { UsersRepository } from './repositories/users.repository.js';
import { createAuthLimiters, createAuthRouter } from './routes/auth.routes.js';
import { demoRouter } from './routes/demo.js';
import { healthRouter } from './routes/health.js';
import { createMobileAuthRouter } from './routes/mobile-auth.routes.js';
import { accessTokens, csrfTokens, passwords } from './security.js';
import { createAuthService } from './services/auth.service.js';

export interface AppDeps {
  users: UsersRepository;
  refreshTokens: RefreshTokenService;
}

/**
 * Builds the Express app without starting it, so tests can use the app without opening a port.
 * Everything that holds state (users, refresh tokens) comes in as a parameter (dependency injection), so a test can
 * pass a fresh, empty store.
 * Middleware order matters.
 */
export function createApp({ users, refreshTokens }: AppDeps) {
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

  // Each is created once and mounted in both chains (mobile and web, below): the limiter so both share one counter
  // per IP, the JSON parser so both keep the same 32 kb limit.
  const globalLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 300, logger });
  const parseJson = express.json({ limit: '32kb' });

  // Composition root: build each layer once and pass it to the next one.
  const authService = createAuthService({ users, passwords, accessTokens, refreshTokens });
  // Two steps for every protected route: check the token's signature (`req.auth`), then load the user it belongs to
  // (`req.user`). Built once here, so every router that needs a logged-in user gets the same chain.
  const checkToken = authenticate(accessTokens);
  const loadUser = loadCurrentUser(users);
  const requireUser = [checkToken, loadUser];
  const authLimiters = createAuthLimiters();
  // Same origin list as CORS: the browser origins we trust to call the API with cookies.
  const csrf = createCsrfProtection({ tokens: csrfTokens, allowedOrigins: config.corsOrigins });

  // Mobile auth: mounted BEFORE CORS on purpose, so its responses never get CORS headers. Native apps do not need
  // them (CORS is a browser rule). A browser page on another origin (even our own frontend, if an XSS bug runs code
  // there) cannot read these responses, and its JSON POST fails the preflight, so the refresh token in the body
  // never reaches browser JavaScript. This holds only while the web frontend is on a DIFFERENT origin than the API:
  // with a same-origin setup (a dev proxy, or nginx serving the frontend and proxying /api), CORS does not apply and
  // /api/mobile must not be reachable from the web origin. Own chain (global limit, JSON body, no cookie parser),
  // and an own 404, so an unknown /api/mobile/* path never falls through to the CORS-enabled routes below.
  const mobileAuthRouter = createMobileAuthRouter({ auth: authService, limiters: authLimiters });
  app.use('/api/mobile', globalLimiter, parseJson);
  app.use('/api/mobile/auth', mobileAuthRouter);
  app.use('/api/mobile', notFoundHandler());

  // Before the body parser and routes: preflight (OPTIONS) requests are answered here, and error responses (400, 404,
  // 413, 500) also carry CORS headers, so the frontend can read the error JSON. Credentials: the refresh-token cookie.
  // Allowed headers: X-CSRF-Token too, or the browser blocks the frontend's CSRF header in the preflight.
  // Exposed headers: the frontend's JavaScript may read the request ID and the rate-limit headers (when to retry).
  app.use(
    corsPolicy({
      allowedOrigins: config.corsOrigins,
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
      exposedHeaders: ['X-Request-Id', 'Retry-After', 'RateLimit', 'RateLimit-Policy'],
    }),
  );

  // Global limit per client IP: generous, it only stops floods and scrapers (users behind one shared IP, e.g. an
  // office or a mobile carrier, share it). After CORS, so web preflights are not counted (the mobile chain above does
  // count them; harmless, browsers are not its clients); before the body parser, so blocked requests are never
  // parsed. Sensitive routes (e.g. login) add their own, much stricter limiter.
  app.use(globalLimiter);

  // Explicit limit instead of the 100 kb default: bytes past 32 kb are never buffered in memory or parsed, and the
  // client gets 413. (The rest of the body is still read and thrown away; slow or huge uploads are stopped by timeouts
  // or a reverse proxy, not by this.) The biggest planned request, a post (10,000 characters, up to ~30 kb in UTF-8
  // with non-Latin text), still fits.
  app.use(parseJson);
  // Fills `req.cookies` (the refresh-token cookie). No secret: cookies are not signed here, the refresh token is a
  // random value the server looks up, so a forged one is simply unknown.
  app.use(cookieParser());
  // Every POST/PUT/PATCH/DELETE from here on needs an allowed Origin and the CSRF token (GET/HEAD/OPTIONS skip it).
  // After cookie-parser (it reads the CSRF cookie); before the routes and their strict limiters, so forged requests
  // never reach a handler or use up a user's login budget. The mobile routes above are not covered: they use no cookies.
  app.use(csrf.protect);

  app.use('/api/health', healthRouter);
  const authRouter = createAuthRouter({ auth: authService, requireUser, limiters: authLimiters, issueCsrfToken: csrf.issueToken });
  // If this path changes, change the refresh cookie's Path in auth.controller.ts too, or browsers stop sending it.
  app.use('/api/auth', authRouter);
  if (config.enableDemoRoutes) app.use('/api/demo', demoRouter);

  // Must come after all routes: 404 for anything unmatched, then one handler that turns every error into JSON.
  app.use(notFoundHandler());
  app.use(errorHandler());

  return app;
}
