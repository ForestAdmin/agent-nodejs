import type { Logger, MakeCommands } from '../types';
import type { Command } from 'commander';

import actionRunner from '../dialogs/action-runner';
import askToOverwriteCustomizations from '../dialogs/ask-to-overwrite-customizations';
import checkLatestVersion from '../dialogs/check-latest-version';
import { BusinessError } from '../errors';
import { validateEnvironmentVariables } from '../services/environment-variables';
import HttpServer from '../services/http-server';
import publish from '../services/publish';
import { loginIfMissingAuthAndReturnEnvironmentVariables } from '../shared';

const askToOverwriteCustomizationsOrAbortCommand = async (
  logger: Logger,
  httpServer: HttpServer,
): Promise<void> => {
  if (
    !(await askToOverwriteCustomizations(
      logger.spinner,
      httpServer.getLastPublishedCodeDetails.bind(httpServer),
    ))
  ) {
    throw new BusinessError('Operation aborted');
  }
};

export default (program: Command, context: MakeCommands) => {
  const {
    logger,
    getCurrentVersion,
    distPathManager,
    buildEventSubscriber,
    buildHttpServer,
    getEnvironmentVariables,
    login,
  } = context;
  const { spinner } = logger;

  program
    .command('publish')
    .description('Publish your code customizations')
    .option('-f, --force', 'Force the publication without asking for confirmation')
    .action(
      actionRunner(spinner, async (options: { force: boolean }) => {
        await checkLatestVersion(spinner, getCurrentVersion(), HttpServer.getLatestVersion);

        spinner.start('Publishing code customizations');
        const vars = await loginIfMissingAuthAndReturnEnvironmentVariables(
          login,
          logger,
          getEnvironmentVariables,
        );
        validateEnvironmentVariables(vars);
        const httpServer = buildHttpServer(vars);
        if (!options.force) await askToOverwriteCustomizationsOrAbortCommand(logger, httpServer);

        spinner.start('Publishing code customizations');
        const subscriptionId = await publish(httpServer, distPathManager);
        const subscriber = buildEventSubscriber(vars);

        try {
          const { error } = await subscriber.subscribeToCodeCustomization(subscriptionId);

          if (error) {
            spinner.fail(`Something went wrong: ${error}`);
          } else {
            spinner.succeed('Code customizations published');
          }
        } catch (error) {
          throw new BusinessError(error.message);
        } finally {
          subscriber.destroy();
        }
      }),
    );
};
