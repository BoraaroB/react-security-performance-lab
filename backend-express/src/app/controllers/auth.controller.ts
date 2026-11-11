import type { RequestHandler } from 'express';
import type { LoginInput, RegisterInput } from '../schemas/auth.schemas.js';
import type { AuthService } from '../services/auth.service.js';

// Controllers only translate HTTP ↔ service calls: read the (already validated) request, call the service, send JSON.
export function createAuthController(auth: AuthService) {
  const login: RequestHandler<unknown, unknown, LoginInput, unknown> = async (req, res) => {
    // Express 5 passes a rejected promise (e.g. INVALID_CREDENTIALS) to the error handler on its own.
    const { email, password } = req.body;
    const result = await auth.login(email, password);
    res.json(result);
  };

  const register: RequestHandler<unknown, unknown, RegisterInput, unknown> = async (req, res) => {
    const result = await auth.register(req.body);
    // 201 Created: a new resource (the account) exists now.
    res.status(201).json(result);
  };

  return { login, register };
}
