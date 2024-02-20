import { Command } from 'commander';

import actionRunner from '../dialogs/action-runner';
import checkLatestVersion from '../dialogs/check-latest-version';
import {
  validateEnvironmentVariables,
  validateMissingForestEnvSecret,
} from '../services/environment-variables';
import HttpServer from '../services/http-server';
import { loginIfMissingAuthAndReturnEnvironmentVariables } from '../shared';
import { MakeCommands } from '../types';

export default (program: Command, context: MakeCommands) => {
  const { logger, getCurrentVersion, login, getEnvironmentVariables, buildHttpServer } = context;
  program
    .command('logs')
    .option(
      '-e, --env-secret <string>',
      'Environment secret, you can find it in your environment settings',
    )
    .description('Display the logs of the published customizations')
    .action(
      actionRunner(logger.spinner, async (options: { envSecret: string }) => {
        await checkLatestVersion(logger.spinner, getCurrentVersion(), HttpServer.getLatestVersion);

        const vars = await loginIfMissingAuthAndReturnEnvironmentVariables(
          login,
          logger,
          getEnvironmentVariables,
        );

        vars.FOREST_ENV_SECRET = options.envSecret || vars.FOREST_ENV_SECRET;
        validateMissingForestEnvSecret(vars.FOREST_ENV_SECRET, 'logs');

        validateEnvironmentVariables(vars);
        const httpServer = buildHttpServer(vars);

        logger.spinner.start('Fetching logs');
        const logs = await httpServer.getLogs();
        logger.spinner.succeed('Logs fetched');

        if (logs?.length > 0) {
          logger.spinner.stop();
          logs.forEach(log => logger.log(log));
        } else {
          logger.spinner.warn('No logs available');
        }
      }),
    );
};
