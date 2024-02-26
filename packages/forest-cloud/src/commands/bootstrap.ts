import { Command } from 'commander';

import actionRunner from '../dialogs/action-runner';
import bootstrap from '../services/bootstrap';
import {
  validateEnvironmentVariables,
  validateMissingForestEnvSecret,
} from '../services/environment-variables';
import {
  askToOverwriteCustomizationsOrAbortCommand,
  loginIfMissingAuthAndReturnEnvironmentVariables,
} from '../shared';
import { MakeCommands } from '../types';

export default (program: Command, context: MakeCommands) => {
  const { logger, buildHttpServer, bootstrapPathManager, login, getEnvironmentVariables } = context;

  program
    .command('bootstrap')
    .description('Bootstrap your project')
    .argument('<name>', 'The name of your project folder')
    .option(
      '-e, --env-secret <string>',
      'Environment secret, you can find it in your environment settings. (env: FOREST_ENV_SECRET).',
    )
    .action(
      actionRunner(logger.spinner, async (folderName: string, options: { envSecret: string }) => {
        logger.spinner.start('Bootstrapping project');
        bootstrapPathManager.folderName = folderName;

        const vars = await loginIfMissingAuthAndReturnEnvironmentVariables(
          login,
          logger,
          getEnvironmentVariables,
        );

        vars.FOREST_ENV_SECRET = options.envSecret || vars.FOREST_ENV_SECRET;
        validateMissingForestEnvSecret(vars.FOREST_ENV_SECRET, 'bootstrap');

        validateEnvironmentVariables(vars);

        logger.spinner.succeed('Environment found');

        const httpServer = buildHttpServer(vars);
        await askToOverwriteCustomizationsOrAbortCommand(logger, httpServer);

        logger.spinner.start();
        await bootstrap(vars, httpServer, bootstrapPathManager);
        logger.spinner.succeed(
          'Project successfully bootstrapped. You can start creating your customizations!',
        );
      }),
    );
};
