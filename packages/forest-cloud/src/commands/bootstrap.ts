import { Command } from 'commander';

import actionRunner from '../dialogs/action-runner';
import askQuestion from '../dialogs/ask-question';
import displayCustomizationInfo from '../dialogs/display-customization-info';
import { BusinessError } from '../errors';
import bootstrap from '../services/bootstrap';
import {
  validateEnvironmentVariables,
  validateMissingForestEnvSecret,
} from '../services/environment-variables';
import { loginIfMissingAuthAndReturnEnvironmentVariables } from '../shared';
import { MakeCommands } from '../types';

export default (program: Command, context: MakeCommands) => {
  const { logger, buildHttpServer, bootstrapPathManager, login, getEnvironmentVariables } = context;

  program
    .command('bootstrap')
    .description('Bootstrap your project')
    .argument('<name>', 'The name of your project folder')
    .option(
      '-e, --env-secret <string>',
      'Environment secret, you can find it in your environment settings.' +
        ' (you can also pass it with environment variable FOREST_ENV_SECRET)',
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

        const details = await httpServer.getLastPublishedCodeDetails();

        if (details) {
          displayCustomizationInfo(logger.spinner, details);
          logger.spinner.warn(
            'If you continue it will boostrap a new customization project from scratch',
          );
          logger.spinner.stop();

          if (!(await askQuestion('Do you want to continue?'))) {
            throw new BusinessError('Operation aborted');
          }
        }

        logger.spinner.start();
        await bootstrap(vars, httpServer, bootstrapPathManager);
        logger.spinner.succeed(
          'Project successfully bootstrapped. You can start creating your customizations!',
        );
      }),
    );
};
