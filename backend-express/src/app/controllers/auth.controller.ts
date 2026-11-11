import type { RequestHandler } from 'express';
import type { LoginInput } from '../schemas/auth.schemas.js';
import type { AuthService } from '../services/auth.service.js';

// Controllers only translate HTTP ↔ service calls: read the (already validated) request, call the service, send JSON.
export function createAuthController(auth: AuthService) {
  const login: RequestHandler<unknown, unknown, LoginInput, unknown> = async (req, res) => {
    // Express 5 passes a rejected promise (e.g. INVALID_CREDENTIALS) to the error handler on its own.
    res.json(await auth.login(req.body.email, req.body.password));
  };

  return { login };
}
