import { Command } from 'commander';

import actionRunner from '../dialogs/action-runner';
import checkLatestVersion from '../dialogs/check-latest-version';
import { BusinessError } from '../errors';
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
      'Environment secret, you can find it in your environment settings. (env: FOREST_ENV_SECRET)',
    )
    .option('-n, --tail <integer>', 'Number of lines to show from the end of the logs')
    .description('Display the logs of the published customizations')
    .action(
      actionRunner(logger.spinner, async (options: { envSecret: string; tail: number }) => {
        await checkLatestVersion(logger.spinner, getCurrentVersion(), HttpServer.getLatestVersion);

        if (options.tail !== undefined && !Number.isInteger(Number(options.tail))) {
          throw new BusinessError('The --tail (-n) option must be an integer');
        }

        const vars = await loginIfMissingAuthAndReturnEnvironmentVariables(
          login,
          logger,
          getEnvironmentVariables,
        );

        vars.FOREST_ENV_SECRET = options.envSecret || vars.FOREST_ENV_SECRET;
        validateMissingForestEnvSecret(vars.FOREST_ENV_SECRET, 'logs');

        validateEnvironmentVariables(vars);

        const logs = await buildHttpServer(vars).getLogs(options.tail);

        if (logs?.length > 0) {
          logger.spinner.stop();
          logs.forEach(log => logger.log(log));
        } else {
          logger.spinner.warn('No logs available');
        }
      }),
    );
};
