#!/usr/bin/env node
/* eslint-disable no-console */

import type * as BuildWorkflowExecutor from './build-workflow-executor';
import type * as CliCore from './cli-core';
import type * as Errors from './errors';

import checkNodeVersion from './check-node-version';

// Fail fast with a clear message on an unsupported Node.js runtime before requiring the rest
// of the CLI: its transitive dependencies (koa, @langchain/openai) would otherwise crash with
// a cryptic low-level error on an old runtime, hiding the real cause. The heavy requires below
// are deferred until after the guard so they are never evaluated on a runtime too old to load
// them.
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
