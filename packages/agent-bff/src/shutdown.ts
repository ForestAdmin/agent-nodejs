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
  /**
   * Anything that must reach its destination before the process ends — today the buffered
   * OpenTelemetry spans. It runs alongside `server.stop()` and is awaited with it, so the exit
   * cannot cut an export that is still in flight.
   */
  flush?: () => Promise<void>;
  /**
   * The flush's own, much shorter deadline. It deliberately does not share `graceMs`: finishing a
   * request someone is waiting on is worth ten seconds, telemetry is not, and an unreachable
   * collector that held the process for the full grace period would be SIGKILLed by an orchestrator
   * whose own patience starts at the same ten seconds — losing the shutdown, not just the spans.
   */
  flushMs?: number;
  /** Signal registration, as a seam: a test must not arm a handler on the real process. */
  onSignal?: (signal: NodeJS.Signals, handler: () => void) => void;
  exit?: (code: number) => void;
}

export const SIGNALS: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
export const DEFAULT_GRACE_MS = 10_000;
export const FORCE_EXIT_MS = 1_000;
export const DEFAULT_FLUSH_MS = 2_000;

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
 * Gives a promise a deadline, resolving either way — a slow collector should cost the shutdown its
 * last spans, not its ability to end. The timer is cleared on settle so it cannot hold the loop open
 * once the work is done.
 */
function bounded(work: Promise<void>, ms: number): Promise<void> {
  return new Promise(resolve => {
    const timer = setTimeout(resolve, ms);

    void work
      .catch(() => undefined)
      .then(() => {
        clearTimeout(timer);
        resolve();
      });
  });
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
    flush,
    flushMs = DEFAULT_FLUSH_MS,
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

    // allSettled, not all: a failing `stop()` must not short-circuit the flush. Promise.all is
    // fail-fast, so the exit would fire while the export was still in flight and the force-exit
    // fallback would cut it — losing exactly the telemetry that explains the failed shutdown.
    Promise.allSettled([server.stop(graceMs), flush ? bounded(flush(), flushMs) : undefined]).then(
      ([stopped]) => {
        if (interrupted) return;

        if (stopped.status === 'rejected') {
          // The server failed to close cleanly. Nothing left to salvage, and staying alive would
          // hold the container open until it is killed — report it through the exit code instead.
          logger?.('Error', 'Shutdown failed, exiting anyway', { signal });
          exit(1);

          return;
        }

        logger?.('Info', 'Forest BFF stopped');
        exit(0);
      },
    );
  };

  for (const signal of SIGNALS) {
    onSignal(signal, handle(signal));
  }
}
