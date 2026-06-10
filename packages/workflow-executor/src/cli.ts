#!/usr/bin/env node
/* eslint-disable no-console */
// CLI entrypoint with side effects, not unit-testable; the guard and run wiring it composes are
// unit-tested in check-node-version and cli-core.
/* istanbul ignore file */

import checkNodeVersion from './check-node-version';

// Run the guard before the rest of the CLI loads. The heavy modules are imported dynamically so
// they are evaluated only after the guard: a static import would load koa / @langchain/openai
// first and crash cryptically on an old runtime, before the guard could report.
checkNodeVersion();

if (require.main === module) {
  void (async () => {
    const { buildDatabaseExecutor, buildInMemoryExecutor } = await import(
      './build-workflow-executor'
    );
    const { runCli } = await import('./cli-core');
    const { extractErrorMessage } = await import('./errors');

    runCli(process.argv.slice(2), process.env, {
      buildDatabase: buildDatabaseExecutor,
      buildInMemory: buildInMemoryExecutor,
    }).catch((err: unknown) => {
      console.error(`Error: ${extractErrorMessage(err)}`);
      process.exit(1);
    });
  })();
}
