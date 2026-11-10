/**
 * Graceful shutdown for a Node HTTP server.
 *
 * Why: on deploy or restart the platform sends SIGTERM. Exiting right away cuts off requests that are
 * still running (a half-saved form, a failed payment). Instead we stop accepting new connections,
 * let in-flight requests finish, run cleanup (close DB, flush logs), and only then exit.
 * A timeout guarantees we still exit if something hangs.
 *
 * It also handles crashes (`uncaughtException`, `unhandledRejection`): after one, the process is in an unknown
 * state (half-updated data, a leaked lock), so it must not keep serving. We log the error as `fatal`, shut down
 * the same way, and exit with code 1 so Docker/systemd restart the process and monitoring sees a failure.
 */
import type { Server } from 'node:http';

export interface ShutdownLogger {
  info: (message: string) => void;
  error: (message: string, error?: unknown) => void;
  /** Used for crashes. Falls back to `error` when missing. */
  fatal?: (message: string, error?: unknown) => void;
}

export interface GracefulShutdownOptions {
  /** Max time to wait for in-flight requests and cleanup before forcing exit. Default: 10 s. */
  timeoutMs?: number;
  /** Signals to listen for. Default: SIGINT (Ctrl+C) and SIGTERM (Docker, Kubernetes, tsx watch). */
  signals?: NodeJS.Signals[];
  /** Extra cleanup after the server stops accepting requests (close DB pools, flush logs, ...). */
  onShutdown?: () => Promise<void> | void;
  /** Log `uncaughtException` / `unhandledRejection` as fatal, then shut down with exit code 1. Default: true. */
  handleProcessErrors?: boolean;
  logger?: ShutdownLogger;
}

const consoleLogger: ShutdownLogger = {
  info: (message) => console.log(message),
  error: (message, error) => console.error(message, error),
};

/** Registers signal handlers. Returns `shutdown` so you can also trigger it manually (e.g. in tests). */
export function registerGracefulShutdown(server: Server, options: GracefulShutdownOptions = {}) {
  const {
    timeoutMs = 10_000,
    signals = ['SIGINT', 'SIGTERM'],
    onShutdown,
    handleProcessErrors = true,
    logger = consoleLogger,
  } = options;
  let shuttingDown = false;
  // Sticky: once any trigger asked for a failure code, a clean finish must not turn it back into 0.
  let finalExitCode = 0;

  async function shutdown(reason: string, exitCode = 0): Promise<void> {
    if (exitCode !== 0) {
      finalExitCode = exitCode;
      // Also covers the case where nothing calls process.exit(): if cleanup hangs on a promise that holds no
      // timer or socket, the event loop empties and Node exits on its own, with this code instead of 0.
      process.exitCode = exitCode;
    }
    // A second Ctrl+C (or a crash) while we are already shutting down should not start a second shutdown.
    if (shuttingDown) return;
    shuttingDown = true;

    // Safety net: force exit if requests or cleanup hang. unref() so this timer alone does not keep the process alive.
    // Created before any logging, so even a logger that throws cannot stop the exit.
    const forceExitTimer = setTimeout(() => {
      try {
        logger.error(`Shutdown timed out after ${timeoutMs} ms, forcing exit`);
        server.closeAllConnections();
      } finally {
        process.exit(1);
      }
    }, timeoutMs);
    forceExitTimer.unref();

    try {
      logger.info(`${reason} received, shutting down gracefully...`);
      // Stop accepting new connections; resolves when all in-flight requests have finished.
      const closed = new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      // Idle keep-alive connections would otherwise keep close() waiting until they time out.
      server.closeIdleConnections();
      await closed;
      await onShutdown?.();
      logger.info('Shutdown complete');
      process.exit(finalExitCode);
    } catch (error) {
      logger.error('Error during shutdown', error);
      process.exit(1);
    }
  }

  for (const signal of signals) {
    process.on(signal, () => void shutdown(signal));
  }

  if (handleProcessErrors) {
    // Adding these listeners turns off Node's default "print and crash", so each one MUST end in an exit.
    // shutdown() always ends the process: through process.exit(), the force-exit timer, or (if the event loop
    // empties first) a natural exit with process.exitCode = 1.
    const onCrash = (reason: string) => (error: unknown) => {
      try {
        (logger.fatal ?? logger.error)(reason, error);
      } finally {
        void shutdown(reason, 1);
      }
    };
    process.on('uncaughtException', onCrash('uncaughtException'));
    process.on('unhandledRejection', onCrash('unhandledRejection'));
  }

  return { shutdown };
}
