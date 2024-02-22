import { Command } from 'commander';

import actionRunner from '../dialogs/action-runner';
import checkLatestVersion from '../dialogs/check-latest-version';
import HttpServer from '../services/http-server';
import { MakeCommands } from '../types';

export default (program: Command, context: MakeCommands) => {
  const { logger, getCurrentVersion } = context;

  program.option('-v, --version', 'Output the version number').action(
    actionRunner(logger.spinner, async () => {
      // we want to display before to display the warning
      const version = getCurrentVersion();
      logger.log(version);
      await checkLatestVersion(logger.spinner, version, HttpServer.getLatestVersion);
    }),
  );
};
