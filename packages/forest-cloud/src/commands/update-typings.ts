import { Command } from 'commander';

import actionRunner from '../dialogs/action-runner';
import checkLatestVersion from '../dialogs/check-latest-version';
import { validateEnvironmentVariables } from '../services/environment-variables';
import HttpServer from '../services/http-server';
import { updateTypingsWithCustomizations } from '../services/update-typings';
import { loginIfMissingAuthAndReturnEnvironmentVariables } from '../shared';
import { MakeCommands } from '../types';

export default (program: Command, context: MakeCommands) => {
  const {
    logger,
    getCurrentVersion,
    buildHttpServer,
    distPathManager,
    bootstrapPathManager,
    login,
    getEnvironmentVariables,
  } = context;
  program
    .command('update-typings')
    .description(
      'Update your typings file to synchronize code autocompletion with your datasource ' +
        '(whenever its schema changes)',
    )
    .action(
      actionRunner(logger.spinner, async () => {
        await checkLatestVersion(logger.spinner, getCurrentVersion(), HttpServer.getLatestVersion);

        logger.spinner.start('Updating typings');
        const vars = await loginIfMissingAuthAndReturnEnvironmentVariables(
          login,
          logger,
          getEnvironmentVariables,
        );
        validateEnvironmentVariables(vars);

        const datasources = await buildHttpServer(vars).getDatasources();

        await updateTypingsWithCustomizations(datasources, distPathManager, bootstrapPathManager);
        logger.spinner.succeed('Your typings have been updated');
      }),
    );
};
