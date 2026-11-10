# PR 04b: Crash handlers (`uncaughtException` / `unhandledRejection`)

## What and why
A forgotten `await` or a `throw` inside a timer escapes the Express error handler. Node then prints the error and dies,
without our logger, request IDs, or graceful shutdown. This PR catches both events in `lib/graceful-shutdown`:
log the error as `fatal` with the stack, let in-flight requests finish, then exit with code **1**.
The process does NOT keep running: after a crash its state is unknown (half-written data, a leaked lock).
The non-zero exit code is what makes Docker/systemd restart it and alerts fire (before this PR, a clean finish always
exited 0, even after a crash).
Topics: API security (fail safe, no broken process serving traffic) and observability.

## Changes
- `backend-express/src/lib/graceful-shutdown/index.ts`: `shutdown(reason, exitCode = 0)`; new option `handleProcessErrors`
  (default `true`) adds the two crash listeners; the exit code is "sticky" and is also set as `process.exitCode`, so a crash
  during a SIGTERM shutdown, or cleanup that hangs, still ends with 1; the force-exit timer is armed before any logging,
  so a broken logger cannot stop the exit; optional `logger.fatal` (falls back to `error`).
- `backend-express/src/lib/graceful-shutdown/README.md`: the new option and an exit-code table.
- `backend-express/src/index.ts`: passes `fatal` from the pino logger. Also handles the `app.listen` error: Express 5 passes
  `EADDRINUSE` (port taken) to the callback, so before this PR the app logged "listening" and exited with 0.

## How to test
There is no route that crashes on purpose (it would be a free DoS button), so use a small script:
```bash
cd backend-express
cat > /tmp/crash.mts <<'TS'
await import(process.cwd() + '/src/index.ts');
setTimeout(() => void Promise.reject(new Error('boom')), 800);
TS
npx tsx /tmp/crash.mts; echo "exit=$?"
# FATAL: unhandledRejection  err: { message: "boom", stack: ... }
# INFO: unhandledRejection received, shutting down gracefully...
# INFO: Shutdown complete
# exit=1
```
Ctrl+C on `npm run dev` still exits with `0`.

## How to reuse in another project
Copy `src/lib/graceful-shutdown/` (no npm packages). Wiring:
```ts
const server = app.listen(4000);
registerGracefulShutdown(server, {
  logger: {
    info: (msg) => logger.info(msg),
    error: (msg, err) => logger.error({ err }, msg),
    fatal: (msg, err) => logger.fatal({ err }, msg),
  },
});
```

## Verification
- `npm run typecheck` and `npm run build`: no errors.
- Temporary scripts (not committed), exit code checked each time:
  unhandled rejection → 1; `throw` in a timer → 1; rejection with a string (not an `Error`) → 1;
  a 1 s request in flight during a crash → the client gets its response, then exit 1;
  a rejection inside `onShutdown` during a SIGTERM shutdown → 1 (sticky code); a request that never ends → force exit after `timeoutMs` → 1;
  plain SIGTERM → 0; `onShutdown` that never settles → 1 (via `process.exitCode`); a logger that throws → Node's own code 7, not stuck.
- Port 4000 already taken → `FATAL Server failed to start` (EADDRINUSE), exit 1.
- Real app: `FATAL` line with the stack is printed in dev (pino-pretty worker) and in production (JSON, `"level":60`) before exit 1.

## Review
- **Fixed** (both reviewers): after a crash, cleanup that hangs on a promise with no timer or socket behind it let the event loop
  empty, and Node exited with 0 (the force-exit timer is `unref()`'d). Now `process.exitCode = 1` is set too.
- **Fixed** (code-reviewer): a logger that throws before the force-exit timer existed left the process running.
  The timer is now armed first, and the crash listener and the timer use `try/finally` around logging.
- **Fixed** (code-reviewer): `EADDRINUSE` at startup logged "listening" and exited 0 (existed before this PR, but it is the same
  "fail with a non-zero code" goal, 4 lines).
- **Fixed** (security-reviewer): the PR text said `shutdown()` always exited 0; only the clean finish did.
- **Postponed** (security-reviewer asked for a manual test): during the drain, a client with an open keep-alive connection
  can still send new requests and they are served, for up to `timeoutMs` (10 s). Confirmed with `curl` (two requests on one
  connection). It affects SIGTERM too and exists since step 01; fixing it (send `Connection: close` while shutting down)
  is a separate concept → "Known gaps" in `docs/PROGRESS.md`.

## Interview questions
1. **What should a Node server do after `uncaughtException`?** Log it, stop accepting traffic, finish in-flight
   requests if possible, and exit with a non-zero code. Never "log and continue": the state may be corrupt.
   A supervisor (Docker, Kubernetes, systemd, PM2) starts a fresh process.
2. **Why must an `unhandledRejection` listener always end in an exit?** Since Node 15 an unhandled rejection crashes the
   process by default. Adding a listener turns that off, so a listener that only logs leaves a broken process running.
3. **Why does the exit code matter?** Restart policies (`on-failure`), Kubernetes `CrashLoopBackOff`, and alerts look at it.
   Exit 0 after a crash looks like a normal stop, so nobody gets paged.
