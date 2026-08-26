#!/usr/bin/env node
/* istanbul ignore file */
import createConsoleLogger from './adapters/console-logger';
import { reportFatalError } from './cli-core';
import dispatchCli from './cli-dispatch';
import armShutdown from './shutdown';

if (require.main === module) {
  dispatchCli(process.argv.slice(2), process.env)
    .then(({ exitCode, server }) => {
      // Only the server command has anything to shut down; `openapi` and the flags
      // have already finished by the time they return.
      if (server) armShutdown({ server, logger: createConsoleLogger() });
      if (exitCode !== 0) process.exitCode = exitCode;
    })
    .catch(reportFatalError);
}
