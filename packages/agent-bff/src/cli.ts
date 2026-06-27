#!/usr/bin/env node
/* istanbul ignore file */
import runCli, { reportFatalError } from './cli-core';

if (require.main === module) {
  runCli(process.env).catch(reportFatalError);
}
