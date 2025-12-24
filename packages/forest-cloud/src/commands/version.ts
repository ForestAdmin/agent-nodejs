import type { MakeCommands } from '../types';
import type { Command } from 'commander';

import actionRunner from '../dialogs/action-runner';
import checkLatestVersion from '../dialogs/check-latest-version';
import { BusinessError } from '../errors';
import HttpServer from '../services/http-server';

export default (program: Command, context: MakeCommands) => {
  const { logger, getCurrentVersion } = context;

  program.option('-v, --version', 'Output the version number').action(
    actionRunner(logger.spinner, async (_, command) => {
      // it is a bug from commander action is always called when the command
      // does not match the implemented commands. To avoid this we check if
      // there are any arguments and throw an error if it is the case.
      if (command.args.length > 0) {
        throw new BusinessError(`unknown command ${command.args.join(' ')}`);
      }

      // we want to display before to display the warning
      const version = getCurrentVersion();
      logger.log(version);
      await checkLatestVersion(logger.spinner, version, HttpServer.getLatestVersion);
    }),
  );
};
