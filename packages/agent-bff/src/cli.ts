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
      // Only the server command has anything to shut down; `openapi` and the flags
      // have already finished by the time they return.
      // flushTracing is a no-op unless the image's tracing preload armed an SDK. Wiring it here,
      // rather than letting the preload arm its own signal handler, is what makes the exit wait
      // for the export instead of racing it.
      if (server) armShutdown({ server, logger: createConsoleLogger(), flush: flushTracing });
      if (exitCode !== 0) process.exitCode = exitCode;
    })
    .catch(reportFatalError);
}
