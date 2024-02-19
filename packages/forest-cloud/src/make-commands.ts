import { Command } from 'commander';

import actionRunner from './dialogs/action-runner';
import askToOverwriteCustomizations from './dialogs/ask-to-overwrite-customizations';
import checkLatestVersion from './dialogs/check-latest-version';
import { BusinessError } from './errors';
import bootstrap from './services/bootstrap';
import { validateEnvironmentVariables, validateServerUrl } from './services/environment-variables';
import EventSubscriber from './services/event-subscriber';
import HttpServer from './services/http-server';
import packageCustomizations from './services/packager';
import publish from './services/publish';
import { updateTypingsWithCustomizations } from './services/update-typings';
import {
  BuildEventSubscriber,
  BuildHttpServer,
  EnvironmentVariables,
  Logger,
  Login,
  MakeCommands,
} from './types';

export const getOrRefreshEnvironmentVariables = async (
  login: Login,
  logger: Logger,
  getEnvironmentVariables: () => Promise<EnvironmentVariables>,
): Promise<EnvironmentVariables> => {
  let vars = await getEnvironmentVariables();

  if (!vars.FOREST_AUTH_TOKEN) {
    await login(logger);
    vars = await getEnvironmentVariables();
  }

  return vars;
};

const validateAndBuildHttpServer = (
  envs: EnvironmentVariables,
  buildHttpServer: BuildHttpServer,
): HttpServer => {
  validateEnvironmentVariables(envs);

  return buildHttpServer(envs);
};

const validateAndBuildEventSubscriber = (
  envs: EnvironmentVariables,
  buildEventSubscriber: BuildEventSubscriber,
): EventSubscriber => {
  validateEnvironmentVariables(envs);

  return buildEventSubscriber(envs);
};

export default function makeCommands({
  bootstrapPathManager,
  distPathManager,
  buildEventSubscriber,
  buildHttpServer,
  logger,
  getEnvironmentVariables,
  login,
  getCurrentVersion,
}: MakeCommands): Command {
  // it's very important to use a new instance of Command each time for testing purposes
  const program = new Command();
  const { spinner, log } = logger;

  program.option('-v, --version', 'output the version number').action(
    actionRunner(spinner, async () => {
      // we want to display before to display the warning
      const version = getCurrentVersion();
      log(version);
      await checkLatestVersion(spinner, version, HttpServer.getLatestVersion);
    }),
  );

  program
    .command('update-typings')
    .description(
      'Update your typings file to synchronize code autocompletion with your datasource ' +
        '(whenever its schema changes)',
    )
    .action(
      actionRunner(spinner, async () => {
        await checkLatestVersion(spinner, getCurrentVersion(), HttpServer.getLatestVersion);

        spinner.start('Updating typings');
        const vars = await getOrRefreshEnvironmentVariables(login, logger, getEnvironmentVariables);
        validateEnvironmentVariables(vars);
        const introspection = await validateAndBuildHttpServer(
          vars,
          buildHttpServer,
        ).getIntrospection();

        await updateTypingsWithCustomizations(introspection, distPathManager, bootstrapPathManager);
        spinner.succeed('Your typings have been updated');
      }),
    );

  program
    .command('bootstrap')
    .description('Bootstrap your project')
    .option(
      '-e, --env-secret <string>',
      'Environment secret, you can find it in your environment settings',
    )
    .action(
      actionRunner(spinner, async (options: { envSecret: string }) => {
        spinner.start('Bootstrapping project');
        const vars = await getOrRefreshEnvironmentVariables(login, logger, getEnvironmentVariables);
        const secret = options.envSecret || vars.FOREST_ENV_SECRET;

        if (!secret) {
          throw new BusinessError(
            'Your forest env secret is missing.' +
              ' Please provide it with the `bootstrap --env-secret <your-secret-key>` command or' +
              ' add it to your .env file or in environment variables.',
          );
        }

        spinner.succeed('Environment found');
        spinner.stop();

        const httpServer = validateAndBuildHttpServer(
          { ...vars, FOREST_ENV_SECRET: secret },
          buildHttpServer,
        );

        if (
          !(await askToOverwriteCustomizations(
            spinner,
            httpServer.getLastPublishedCodeDetails.bind(httpServer),
          ))
        ) {
          throw new BusinessError('Operation aborted');
        }

        spinner.start();
        await bootstrap(secret, httpServer, bootstrapPathManager);
        spinner.succeed(
          'Project successfully bootstrapped. You can start creating your customizations!',
        );
      }),
    );

  program
    .command('login')
    .description('Login to your project')
    .action(
      actionRunner(spinner, async () => {
        await checkLatestVersion(spinner, getCurrentVersion(), HttpServer.getLatestVersion);

        spinner.start('Logging in');
        const vars = await getEnvironmentVariables();
        validateServerUrl(vars.FOREST_SERVER_URL);
        await login(logger);
        spinner.succeed('You are now logged in');
      }),
    );

  program
    .command('publish')
    .description('Publish your code customizations')
    .option('-f, --force', 'Force the publication without asking for confirmation')
    .action(
      actionRunner(spinner, async (options: { force: boolean }) => {
        await checkLatestVersion(spinner, getCurrentVersion(), HttpServer.getLatestVersion);

        spinner.start('Publishing code customizations');
        const vars = await getOrRefreshEnvironmentVariables(login, logger, getEnvironmentVariables);
        const httpServer = validateAndBuildHttpServer(vars, buildHttpServer);

        if (
          !options.force &&
          !(await askToOverwriteCustomizations(
            spinner,
            httpServer.getLastPublishedCodeDetails.bind(httpServer),
          ))
        ) {
          throw new BusinessError('Operation aborted');
        }

        spinner.start('Publishing code customizations (operation cannot be cancelled)');
        const subscriptionId = await publish(httpServer, distPathManager);
        const subscriber = validateAndBuildEventSubscriber(vars, buildEventSubscriber);

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

  program
    .command('package')
    .description('Package your code customizations')
    .action(
      actionRunner(spinner, async () => {
        await checkLatestVersion(spinner, getCurrentVersion(), HttpServer.getLatestVersion);

        spinner.start('Packaging code');
        await packageCustomizations(distPathManager);
        spinner.succeed('Code customizations packaged and ready for publish');
      }),
    );

  return program;
}
