import type { MakeCommands } from '../types';
import type { Command } from 'commander';

import actionRunner from '../dialogs/action-runner';
import checkLatestVersion from '../dialogs/check-latest-version';
import { validateServerUrl } from '../services/environment-variables';
import HttpServer from '../services/http-server';

export default (program: Command, context: MakeCommands) => {
  const { logger, getCurrentVersion, getEnvironmentVariables, login } = context;
  const { spinner } = logger;
  program
    .command('login')
    .description('Login to your project')
    .action(
      actionRunner(spinner, async () => {
        await checkLatestVersion(spinner, getCurrentVersion(), HttpServer.getLatestVersion);

        spinner.start('Logging in');
        const vars = await getEnvironmentVariables();
        validateServerUrl(vars.FOREST_SERVER_URL);
        spinner.stop();
        await login(logger);
        spinner.succeed('You are now logged in');
      }),
    );
};
