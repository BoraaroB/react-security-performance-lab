/**
 * Graceful shutdown for a Node HTTP server.
 *
 * Why: on deploy or restart the platform sends SIGTERM. Exiting right away cuts off requests that are
 * still running (a half-saved form, a failed payment). Instead we stop accepting new connections,
 * let in-flight requests finish, run cleanup (close DB, flush logs), and only then exit.
 * A timeout guarantees we still exit if something hangs.
 */
import type { Server } from 'node:http';

export interface ShutdownLogger {
  info: (message: string) => void;
  error: (message: string, error?: unknown) => void;
}

export interface GracefulShutdownOptions {
  /** Max time to wait for in-flight requests and cleanup before forcing exit. Default: 10 s. */
  timeoutMs?: number;
  /** Signals to listen for. Default: SIGINT (Ctrl+C) and SIGTERM (Docker, Kubernetes, tsx watch). */
  signals?: NodeJS.Signals[];
  /** Extra cleanup after the server stops accepting requests (close DB pools, flush logs, ...). */
  onShutdown?: () => Promise<void> | void;
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
    logger = consoleLogger,
  } = options;
  let shuttingDown = false;

  async function shutdown(reason: string): Promise<void> {
    // A second Ctrl+C while we are already shutting down should not start a second shutdown.
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${reason} received, shutting down gracefully...`);

    // Safety net: force exit if requests or cleanup hang. unref() so this timer alone does not keep the process alive.
    const forceExitTimer = setTimeout(() => {
      logger.error(`Shutdown timed out after ${timeoutMs} ms, forcing exit`);
      server.closeAllConnections();
      process.exit(1);
    }, timeoutMs);
    forceExitTimer.unref();

    try {
      // Stop accepting new connections; resolves when all in-flight requests have finished.
      const closed = new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      // Idle keep-alive connections would otherwise keep close() waiting until they time out.
      server.closeIdleConnections();
      await closed;
      await onShutdown?.();
      logger.info('Shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', error);
      process.exit(1);
    }
  }

  for (const signal of signals) {
    process.on(signal, () => void shutdown(signal));
  }

  return { shutdown };
}
