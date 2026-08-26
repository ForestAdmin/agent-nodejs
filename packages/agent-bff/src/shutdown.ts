import type { Logger } from './ports/logger-port';

/** Just enough of `BFFHttpServer` to shut it down, so a test needs no real socket. */
export interface StoppableServer {
  stop(graceMs?: number): Promise<void>;
}

export interface ShutdownOptions {
  server: StoppableServer;
  logger?: Logger;
  /** How long in-flight requests get before their sockets are cut. */
  graceMs?: number;
  /** Signal registration, as a seam: a test must not arm a handler on the real process. */
  onSignal?: (signal: NodeJS.Signals, handler: () => void) => void;
  exit?: (code: number) => void;
}

export const SIGNALS: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
export const DEFAULT_GRACE_MS = 10_000;
export const FORCE_EXIT_MS = 1_000;

/**
 * Ends the process without `process.exit`, which would discard whatever is still buffered on stdout
 * — and stdout is a pipe under Docker, so writes to it are asynchronous. Exiting outright drops the
 * shutdown log lines, in the one place an operator goes looking for them.
 *
 * Setting the code and letting the loop drain flushes them. The fallback timer is unref'd on
 * purpose: it does not hold the process open by itself, so a clean drain still exits immediately,
 * and it only fires if some other handle is keeping the loop alive — which is the case where the
 * process would otherwise never end.
 */
function defaultExit(code: number): void {
  process.exitCode = code;
  setTimeout(() => process.exit(code), FORCE_EXIT_MS).unref();
}

/**
 * Stops the server on a termination signal, then exits.
 *
 * The exit has to be explicit. In the Docker image node runs as PID 1, and the kernel gives PID 1 no
 * default disposition for a signal it has no handler for — so a container with no handler at all is
 * never terminated by `docker stop`, it waits out the grace period and is SIGKILLed, dropping every
 * in-flight request. Registering a handler and then falling through to "the default action" does not
 * work either, for the same reason: nothing would end the process.
 *
 * A second signal gives up on the grace period. Someone pressing Ctrl-C twice, or an orchestrator
 * escalating, is asking to stop waiting, and the exit code says the shutdown did not complete.
 */
export default function armShutdown(options: ShutdownOptions): void {
  const {
    server,
    logger,
    graceMs = DEFAULT_GRACE_MS,
    onSignal = (signal, handler) => {
      process.on(signal, handler);
    },
    exit = defaultExit,
  } = options;

  let stopping = false;
  // The escalation has already reported failure and set the exit code. A `stop()` that finishes
  // afterwards must stay quiet: announcing a clean stop and exiting 0 would overwrite it and
  // report success for a shutdown someone had to interrupt.
  let interrupted = false;

  const handle = (signal: NodeJS.Signals) => () => {
    if (stopping) {
      interrupted = true;
      logger?.('Warn', 'Second termination signal, giving up on the grace period', { signal });
      exit(1);

      return;
    }

    stopping = true;
    logger?.('Info', 'Shutting down', { signal, graceMs });

    server
      .stop(graceMs)
      .then(() => {
        if (interrupted) return;

        logger?.('Info', 'Forest BFF stopped');
        exit(0);
      })
      .catch(() => {
        if (interrupted) return;

        // The server failed to close cleanly. Nothing left to salvage, and staying alive would
        // hold the container open until it is killed — report it through the exit code instead.
        logger?.('Error', 'Shutdown failed, exiting anyway', { signal });
        exit(1);
      });
  };

  for (const signal of SIGNALS) {
    onSignal(signal, handle(signal));
  }
}
