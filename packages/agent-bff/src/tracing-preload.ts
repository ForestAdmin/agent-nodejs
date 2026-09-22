// The `--require` entry point of the Docker image (see the Dockerfile's ENTRYPOINT). Separate from
// `tracing.ts` on purpose: importing the setup must never arm an SDK, only calling it should.
//
// The SDK is handed to `tracing-handle` rather than wired to a signal here. The CLI arms the only
// termination handler, and it flushes through that handle — so a signal arriving before the CLI is
// up cannot be swallowed by a listener that does not terminate anything.
import createConsoleLogger from './adapters/console-logger';
import initTracing from './tracing';
import { setTracingHandle } from './tracing-handle';

// Nothing here may throw. A `--require` runs before the entry point, so an exception aborts the
// process before the BFF exists at all — a dead container in exchange for optional, best-effort
// telemetry. `initTracing` degrades on its own for the cases it knows about; this catches the rest,
// including whatever a future SDK version decides to throw from `start()`.
try {
  setTracingHandle(initTracing());
} catch (error) {
  createConsoleLogger()('Warn', 'OpenTelemetry failed to initialise, starting untraced', {
    reason: error instanceof Error ? error.message : String(error),
  });
}
