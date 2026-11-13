import type { RequestHandler, Response } from 'express';
import type { LoginInput, RegisterInput } from '../schemas/auth.schemas.js';
import type { AuthResult, AuthService } from '../services/auth.service.js';

// The `__Secure-` prefix makes browsers accept this cookie only over HTTPS with `Secure`. Without it, someone on the
// network could plant their OWN refresh token through a plain-HTTP response, and the victim's next refresh would log
// them into the attacker's account. (`__Host-` would be stronger, but it requires `Path=/`.)
const REFRESH_COOKIE = '__Secure-refresh_token';
// Must match where app.ts mounts the auth router. The browser then sends the cookie only to /api/auth/* (login,
// register, /me, refresh, logout), not to the rest of the API, so fewer requests ever carry it.
const REFRESH_COOKIE_PATH = '/api/auth';

function setRefreshCookie(res: Response, refreshToken: AuthResult['refreshToken']) {
  res.cookie(REFRESH_COOKIE, refreshToken.token, {
    httpOnly: true, // JavaScript cannot read it, so an XSS bug cannot steal it
    secure: true, // HTTPS only (Chrome, Firefox and curl treat http://localhost as secure, so dev works too)
    sameSite: 'strict', // not sent on requests that another site starts (the main CSRF defense for this cookie)
    path: REFRESH_COOKIE_PATH,
    expires: refreshToken.expiresAt,
  });
}

function sendAuthResult(res: Response, result: AuthResult, status = 200) {
  setRefreshCookie(res, result.refreshToken);
  // Picked field by field: the refresh token goes only into the cookie, never into the JSON body.
  const body = { accessToken: result.accessToken, user: result.user };
  res.status(status).json(body);
}

// Controllers only translate HTTP ↔ service calls: read the (already validated) request, call the service, send JSON.
export function createAuthController(auth: AuthService) {
  const login: RequestHandler<unknown, unknown, LoginInput, unknown> = async (req, res) => {
    // Express 5 passes a rejected promise (e.g. INVALID_CREDENTIALS) to the error handler on its own.
    const { email, password } = req.body;
    const result = await auth.login(email, password);
    sendAuthResult(res, result);
  };

  const register: RequestHandler<unknown, unknown, RegisterInput, unknown> = async (req, res) => {
    const result = await auth.register(req.body);
    // 201 Created: a new resource (the account) exists now.
    sendAuthResult(res, result, 201);
  };

  const refresh: RequestHandler = async (req, res) => {
    // cookie-parser turns a value that starts with "j:" into an object, so only a string is a token.
    const cookieValue: unknown = req.cookies[REFRESH_COOKIE];
    const token = typeof cookieValue === 'string' ? cookieValue : undefined;
    const result = await auth.refresh(token);
    sendAuthResult(res, result);
  };

  const me: RequestHandler = (req, res) => {
    const user = req.user;
    // The route runs `loadCurrentUser` first, which answers 401 when there is no user. Getting here without one is a
    // wiring mistake: fail closed (500), never answer with an empty user.
    if (!user) throw new Error('GET /me needs loadCurrentUser before it');
    res.json({ user });
  };

  return { login, register, refresh, me };
}
