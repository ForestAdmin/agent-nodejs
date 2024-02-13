import { Command } from 'commander';

import actionRunner from './dialogs/action-runner';
import askToOverwriteCustomizations from './dialogs/ask-to-overwrite-customizations';
import { BusinessError } from './errors';
import bootstrap, { typingsPathAfterBootstrapped } from './services/bootstrap';
import { validateEnvironmentVariables, validateServerUrl } from './services/environment-variables';
import packageCustomizations from './services/packager';
import publish from './services/publish';
import { updateTypingsWithCustomizations } from './services/update-typings';
import { MakeCommands } from './types';

export default function makeCommands({
  getOrRefreshEnvironmentVariables,
  getEnvironmentVariables,
  buildHttpForestServer,
  buildEventSubscriber,
  login,
  buildSpinner,
}: MakeCommands): Command {
  // it's very important to use a new instance of Command each time for testing purposes
  const program = new Command();
  program
    .command('update-typings')
    .description(
      'Update your typings file to synchronize code autocompletion with your datasource ' +
        '(whenever its schema changes)',
    )
    .action(
      actionRunner(buildSpinner, async spinner => {
        spinner.start('Updating typings');
        const vars = await getOrRefreshEnvironmentVariables();
        validateEnvironmentVariables(vars);
        const introspection = await buildHttpForestServer(vars).getIntrospection();
        await updateTypingsWithCustomizations(typingsPathAfterBootstrapped, introspection);
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
      actionRunner(buildSpinner, async (spinner, options: { envSecret: string }) => {
        spinner.start('Bootstrapping project');
        const vars = await getOrRefreshEnvironmentVariables();
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

        const forestServer = buildHttpForestServer({ ...vars, FOREST_ENV_SECRET: secret });

        if (!(await askToOverwriteCustomizations(spinner, forestServer))) {
          throw new BusinessError('Operation aborted');
        }

        spinner.start();
        await bootstrap(secret, forestServer);
        spinner.succeed(
          'Project successfully bootstrapped. You can start creating your customizations!',
        );
      }),
    );

  program
    .command('login')
    .description('Login to your project')
    .action(
      actionRunner(buildSpinner, async spinner => {
        spinner.start('Logging in');
        const vars = await getEnvironmentVariables();
        validateServerUrl(vars.FOREST_SERVER_URL);
        await login();
        spinner.succeed('You are now logged in');
      }),
    );

  program
    .command('publish')
    .description('Publish your code customizations')
    .option('-f, --force', 'Force the publication without asking for confirmation')
    .action(
      actionRunner(buildSpinner, async (spinner, options: { force: boolean }) => {
        const vars = await getOrRefreshEnvironmentVariables();
        const forestServer = buildHttpForestServer(vars);

        if (!options.force && !(await askToOverwriteCustomizations(spinner, forestServer))) {
          throw new BusinessError('Operation aborted');
        }

        spinner.start('Publishing code customizations (operation cannot be cancelled)');
        const subscriptionId = await publish(forestServer);
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

  program
    .command('package')
    .description('Package your code customizations')
    .action(
      actionRunner(buildSpinner, async spinner => {
        spinner.start('Packaging code');
        await packageCustomizations();
        spinner.succeed('Code customizations packaged and ready for publish');
      }),
    );

  return program;
}
