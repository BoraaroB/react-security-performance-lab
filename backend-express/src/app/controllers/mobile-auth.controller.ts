import type { RequestHandler, Response } from 'express';
import type { LoginInput, RegisterInput } from '../schemas/auth.schemas.js';
import type { RefreshTokenBody } from '../schemas/mobile-auth.schemas.js';
import type { AuthResult, AuthService } from '../services/auth.service.js';

// The mobile twin of auth.controller.ts: same service, but the refresh token travels in the JSON body instead of a
// cookie. A native app keeps it in the iOS Keychain / Android Keystore, where other apps cannot read it.
// No cookie is ever set or read here, so these routes need no CSRF check: CSRF abuses cookies the browser adds on its own.
function sendMobileAuthResult(res: Response, result: AuthResult, status = 200) {
  const body = {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken.token,
    // The app can drop a dead token (and show the login screen) without a failed request first.
    refreshTokenExpiresAt: result.refreshToken.expiresAt.toISOString(),
    user: result.user,
  };
  res.status(status).json(body);
}

export function createMobileAuthController(auth: AuthService) {
  const login: RequestHandler<unknown, unknown, LoginInput, unknown> = async (req, res) => {
    const { email, password } = req.body;
    const result = await auth.login(email, password);
    sendMobileAuthResult(res, result);
  };

  const register: RequestHandler<unknown, unknown, RegisterInput, unknown> = async (req, res) => {
    const result = await auth.register(req.body);
    sendMobileAuthResult(res, result, 201);
  };

  const refresh: RequestHandler<unknown, unknown, RefreshTokenBody, unknown> = async (req, res) => {
    // Same rotation and reuse detection as the web: the old token is used up, the app must store the new one.
    const result = await auth.refresh(req.body.refreshToken);
    sendMobileAuthResult(res, result);
  };

  const logout: RequestHandler<unknown, unknown, RefreshTokenBody, unknown> = async (req, res) => {
    // Revokes the whole family on the server; the app then deletes its stored copy. Always 204, like the web route.
    await auth.logout(req.body.refreshToken);
    res.status(204).end();
  };

  return { login, register, refresh, logout };
}
