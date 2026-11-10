# PR 01: Express skeleton

## What and why
Starts the Express 5 + TypeScript (ESM) backend with three basics every API needs:
config validated at startup (a bad `.env` stops the server instead of causing a hole later),
a health endpoint, and graceful shutdown (deploys and restarts don't cut off running requests).
Also adds `docs/PROGRESS.md` so work can resume after `/clear`, and adapts the workflow to "the user pushes and merges".

## Changes
- `backend-express/package.json`, `tsconfig.json`: only `express` + `zod` (later steps add their own packages); strict TS, ESM (`NodeNext`), source maps.
- `backend-express/.env.example`: `NODE_ENV`, `PORT`.
- `src/lib/env/`: **portable** `parseEnv(schema, source)` + `loadEnvFile()` (Node's built-in loader, no `dotenv`).
- `src/lib/graceful-shutdown/`: **portable** `registerGracefulShutdown(server, options)`.
- `src/app/config.ts`: the only place that reads `process.env`.
- `src/app/app.ts`: `createApp()` (no `listen`, so tests can use it), `X-Powered-By` disabled.
- `src/app/routes/health.ts`: `GET /api/health`.
- `src/index.ts`: starts the server and registers graceful shutdown.
- `docs/PROGRESS.md`, `CLAUDE.md`, `.claude/skills/next-step/SKILL.md`: progress log and the new git flow.

## How to test
```bash
cd backend-express
cp .env.example .env        # once
npm run dev                 # http://localhost:4000/api
curl -i localhost:4000/api/health          # 200 {"status":"ok","uptimeSeconds":...}
# Ctrl+C → "SIGINT received, shutting down gracefully..." → "Shutdown complete"
PORT=abc npm run dev        # stops with "PORT: Invalid input: expected number, received NaN"
```

## How to reuse in another project
Copy `src/lib/env/` (needs `zod`) and `src/lib/graceful-shutdown/` (no dependencies). In ESM projects import with `.js`:
```ts
loadEnvFile();
const env = parseEnv(z.object({ PORT: z.coerce.number().default(3000) }), process.env);
const server = app.listen(env.PORT);
registerGracefulShutdown(server, { onShutdown: () => db.close() });
```

## Verification
- `npm run typecheck`: passed. `npm run build`: passed.
- Smoke test: `/api/health` → 200 JSON; SIGTERM → "Shutdown complete"; `PORT=abc` → validation error, exit code 1.
- Known gap: an unknown route returns Express's HTML 404 (JSON errors come in step 03).

## Interview questions
1. **Why validate env vars at startup?** Fail fast: an empty secret or a wrong port is found at deploy time,
   not when the first user hits that code path. You also get typed config instead of `string | undefined`.
2. **What does graceful shutdown do?** On SIGTERM it stops accepting new connections, lets in-flight requests finish,
   closes resources, then exits, with a timeout as a safety net.
3. **Why disable `X-Powered-By`?** It tells attackers which framework you run, which narrows down known exploits.
   It is not real protection on its own, just less information leaked (helmet does it too, in step 05).
