#!/usr/bin/env node
/* istanbul ignore file */
import { reportFatalError } from './cli-core';
import dispatchCli from './cli-dispatch';

if (require.main === module) {
  dispatchCli(process.argv.slice(2), process.env)
    .then(({ exitCode }) => {
      if (exitCode !== 0) process.exitCode = exitCode;
    })
    .catch(reportFatalError);
}
