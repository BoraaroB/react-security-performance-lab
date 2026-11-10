import { Router } from 'express';

export const healthRouter = Router();

// Used by load balancers and uptime checks. It must stay cheap and must not reveal internals
// (versions, hostnames, env values).
healthRouter.get('/', (_req, res) => {
  res.json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()) });
});
