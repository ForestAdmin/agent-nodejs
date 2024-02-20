import { Command } from 'commander';

import checkLatestVersion from '../dialogs/check-latest-version';
import { validateEnvironmentVariables } from '../services/environment-variables';
import HttpServer from '../services/http-server';
import { loginIfMissingAuthAndReturnEnvironmentVariables } from '../shared';
import { MakeCommands } from '../types';

export default (program: Command, context: MakeCommands) => {
  const { logger, getCurrentVersion, login, getEnvironmentVariables, buildHttpServer } = context;
  program
    .command('logs')
    .description('Display the logs of the published customizations')
    .action(async () => {
      await checkLatestVersion(logger.spinner, getCurrentVersion(), HttpServer.getLatestVersion);

      const vars = await loginIfMissingAuthAndReturnEnvironmentVariables(
        login,
        logger,
        getEnvironmentVariables,
      );
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
    });
};
