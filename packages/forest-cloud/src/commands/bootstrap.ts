import { Command } from 'commander';

import actionRunner from '../dialogs/action-runner';
import { BusinessError } from '../errors';
import bootstrap from '../services/bootstrap';
import { validateEnvironmentVariables } from '../services/environment-variables';
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
    .option(
      '-e, --env-secret <string>',
      'Environment secret, you can find it in your environment settings',
    )
    .action(
      actionRunner(logger.spinner, async (options: { envSecret: string }) => {
        logger.spinner.start('Bootstrapping project');
        const vars = await loginIfMissingAuthAndReturnEnvironmentVariables(
          login,
          logger,
          getEnvironmentVariables,
        );

        vars.FOREST_ENV_SECRET = options.envSecret || vars.FOREST_ENV_SECRET;

        if (!vars.FOREST_ENV_SECRET) {
          throw new BusinessError(
            'Your forest env secret is missing.' +
              ' Please provide it with the `bootstrap --env-secret <your-secret-key>` command or' +
              ' add it to your .env file or in environment variables.',
          );
        }

        validateEnvironmentVariables(vars);

        logger.spinner.succeed('Environment found');
        logger.spinner.stop();

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
