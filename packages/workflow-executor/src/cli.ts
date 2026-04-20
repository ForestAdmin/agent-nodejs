#!/usr/bin/env node
/* eslint-disable no-console */

import { buildDatabaseExecutor, buildInMemoryExecutor } from './build-workflow-executor';
import { runCli } from './cli-core';

if (require.main === module) {
  runCli(process.argv.slice(2), process.env, {
    buildDatabase: buildDatabaseExecutor,
    buildInMemory: buildInMemoryExecutor,
  }).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${message}`);
    process.exit(1);
  });
}
