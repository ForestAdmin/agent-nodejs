#!/usr/bin/env node
/* eslint-disable no-console */

import type * as BuildWorkflowExecutor from './build-workflow-executor';
import type * as CliCore from './cli-core';
import type * as Errors from './errors';

import checkNodeVersion from './check-node-version';

// Run the guard before the rest of the CLI loads: a static import would evaluate koa /
// @langchain/openai first and crash cryptically on an old runtime, before the guard could report.
checkNodeVersion();

if (require.main === module) {
  /* eslint-disable global-require, @typescript-eslint/no-var-requires */
  const { buildDatabaseExecutor, buildInMemoryExecutor } =
    require('./build-workflow-executor') as typeof BuildWorkflowExecutor;
  const { runCli } = require('./cli-core') as typeof CliCore;
  const { extractErrorMessage } = require('./errors') as typeof Errors;
  /* eslint-enable global-require, @typescript-eslint/no-var-requires */

  runCli(process.argv.slice(2), process.env, {
    buildDatabase: buildDatabaseExecutor,
    buildInMemory: buildInMemoryExecutor,
  }).catch((err: unknown) => {
    console.error(`Error: ${extractErrorMessage(err)}`);
    process.exit(1);
  });
}
