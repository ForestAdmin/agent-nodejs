#!/usr/bin/env node
/* eslint-disable no-console */

import { buildDatabaseExecutor, buildInMemoryExecutor } from './build-workflow-executor';
import { runCli } from './cli-core';
import { extractErrorMessage } from './errors';

if (require.main === module) {
  runCli(process.argv.slice(2), process.env, {
    buildDatabase: buildDatabaseExecutor,
    buildInMemory: buildInMemoryExecutor,
  }).catch((err: unknown) => {
    console.error(`Error: ${extractErrorMessage(err)}`);
    process.exit(1);
  });
}
