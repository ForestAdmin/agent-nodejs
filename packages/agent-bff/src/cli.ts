#!/usr/bin/env node
/* istanbul ignore file */
import createConsoleLogger from './adapters/console-logger';
import { reportFatalError } from './cli-core';
import dispatchCli from './cli-dispatch';
import armShutdown from './shutdown';
import { flushTracing } from './tracing-handle';

if (require.main === module) {
  dispatchCli(process.argv.slice(2), process.env)
    .then(({ exitCode, server }) => {
      // Only the server has anything to shut down. `openapi` and the flags are already finished by
      // the time they return, and deliberately do NOT flush: calling shutdown on the SDK forces an
      // export attempt whose retries hold the event loop long after the flush stops being awaited —
      // measured at 9s against an unreachable collector, where the command otherwise exits in 1.3s.
      // Losing the spans of a one-shot export is the cheaper side of that trade.
      //
      // Wiring the flush into the shutdown handler, rather than letting the preload arm a handler
      // of its own, is what makes the server's exit wait for the export instead of racing it.
      if (server) armShutdown({ server, logger: createConsoleLogger(), flush: flushTracing });
      if (exitCode !== 0) process.exitCode = exitCode;
    })
    .catch(reportFatalError);
}
