#!/usr/bin/env node
/* istanbul ignore file */
import dispatchCli from './cli-dispatch';

if (require.main === module) {
  dispatchCli(process.argv.slice(2), process.env)
    .then(({ exitCode }) => {
      if (exitCode !== 0) process.exitCode = exitCode;
    })
    .catch(error => {
      process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
