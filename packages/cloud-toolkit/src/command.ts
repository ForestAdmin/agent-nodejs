#!/usr/bin/env node

import { program } from 'commander';
import { configDotenv } from 'dotenv';
import ora from 'ora';

import checkCodeAlreadyDeployed from './dialog/check-code-already-deployed';
import { BusinessError } from './errors';
import actionRunner, {
  actionRunnerWithSpinner,
  multiStepsActionRunner,
} from './services/action-runner';
import bootstrap from './services/bootstrap';
import {
  getEnvironmentVariables,
  getOrRefreshEnvironmentVariables,
  validateEnvironmentVariables,
  validateServerUrl,
} from './services/environment-variables';
import HttpForestServer, { buildHttpForestServer } from './services/http-forest-server';
import login from './services/login';
import packageCustomizations from './services/packager';
import publish from './services/publish';
import updateTypings from './services/update-typings';

configDotenv();

program
  .command('update-typings')
  .description(
    'Update your typings file to synchronize code autocompletion with your datasource ' +
      '(whenever its schema changes)',
  )
  .action(
    actionRunnerWithSpinner(async spinner => {
      spinner.text = 'Updating typings\n';
      const vars = await getOrRefreshEnvironmentVariables();
      validateEnvironmentVariables(vars);
      await updateTypings(buildHttpForestServer(vars), 'typings.d.ts');
      spinner.succeed('Your typings have been updated.');
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
    multiStepsActionRunner([
      async (context, options) => {
        const vars = await getOrRefreshEnvironmentVariables();
        const secret = options.envSecret || vars.FOREST_ENV_SECRET;

        if (!secret) {
          throw new BusinessError(
            'Your forest env secret is missing.' +
              ' Please provide it with the `bootstrap --env-secret <your-secret-key>` command or' +
              ' add it to your .env file or in environment variables.',
          );
        }

        context.forestServer = await buildHttpForestServer({ ...vars, FOREST_ENV_SECRET: secret });
        context.secret = secret;
      },
      async ({ forestServer }: { forestServer: HttpForestServer }) => {
        return checkCodeAlreadyDeployed(forestServer);
      },
      async ({
        secret,
        forestServer,
        spinner,
      }: {
        secret: string;
        forestServer: HttpForestServer;
        spinner: ora.Ora;
      }) => {
        spinner.text = 'Boostrapping project\n';
        spinner.start();

        await bootstrap(secret, forestServer);
        spinner.succeed(
          'Project successfully bootstrapped. You can start creating your customizations!',
        );
      },
    ]),
  );

program
  .command('login')
  .description('Login to your project')
  .action(
    actionRunnerWithSpinner(async spinner => {
      spinner.text = 'Logging in\n';
      const vars = await getEnvironmentVariables();
      validateServerUrl(vars.FOREST_SERVER_URL);
      await login();
      spinner.succeed('You are now logged in');
    }),
  );

program
  .command('publish')
  .description('Publish your code customizations')
  .action(
    multiStepsActionRunner([
      async context => {
        const vars = await getOrRefreshEnvironmentVariables();
        validateEnvironmentVariables(vars);
        context.forestServer = await buildHttpForestServer(vars);
      },
      async ({ forestServer }: { forestServer: HttpForestServer }) => {
        return checkCodeAlreadyDeployed(forestServer);
      },
      async ({ forestServer, spinner }: { forestServer: HttpForestServer; spinner: ora.Ora }) => {
        spinner.text = 'Publishing code customizations\n';
        spinner.start();
        await publish(forestServer);
        spinner.succeed('Code customizations published');
      },
    ]),
  );

program
  .command('package')
  .description('Publish your code customizations')
  .action(
    actionRunner(async spinner => {
      spinner.text = 'Packaging code\n';
      await packageCustomizations();
      spinner.succeed('Code customizations packaged and ready for publish');
    }),
  );

program.parse();
