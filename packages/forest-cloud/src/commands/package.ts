import { Command } from 'commander';

import actionRunner from '../dialogs/action-runner';
import checkLatestVersion from '../dialogs/check-latest-version';
import HttpServer from '../services/http-server';
import packageCustomizations from '../services/packager';
import { MakeCommands } from '../types';

export default (program: Command, context: MakeCommands) => {
  const { logger, getCurrentVersion, distPathManager } = context;
  program
    .command('package')
    .description('Package your code customizations')
    .action(
      actionRunner(logger.spinner, async () => {
        await checkLatestVersion(logger.spinner, getCurrentVersion(), HttpServer.getLatestVersion);

        logger.spinner.start('Packaging code');
        await packageCustomizations(distPathManager);
        logger.spinner.succeed('Code customizations packaged and ready for publish');
      }),
    );
};
