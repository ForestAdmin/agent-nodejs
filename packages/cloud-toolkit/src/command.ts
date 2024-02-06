#!/usr/bin/env node

import { program } from 'commander';
import { configDotenv } from 'dotenv';

import askToOverwriteCustomizations from './dialogs/ask-to-overwrite-customizations';
import { BusinessError } from './errors';
import actionRunner from './services/action-runner';
import bootstrap from './services/bootstrap';
import {
  getEnvironmentVariables,
  getOrRefreshEnvironmentVariables,
  validateEnvironmentVariables,
  validateServerUrl,
} from './services/environment-variables';
import HttpForestServer from './services/http-forest-server';
import login from './services/login';
import packageCustomizations from './services/packager';
import publish from './services/publish';
import updateTypings from './services/update-typings';
import { EnvironmentVariables } from './types';

configDotenv();

const buildHttpForestServer = (envs: EnvironmentVariables): HttpForestServer => {
  validateEnvironmentVariables(envs);

  return new HttpForestServer(
    envs.FOREST_SERVER_URL,
    envs.FOREST_ENV_SECRET,
    envs.FOREST_AUTH_TOKEN,
  );
};

program
  .command('update-typings')
  .description(
    'Update your typings file to synchronize code autocompletion with your datasource ' +
      '(whenever its schema changes)',
  )
  .action(
    actionRunner(async spinner => {
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
    actionRunner(async (spinner, options) => {
      spinner.text = 'Checking environment\n';
      spinner.start();
      const vars = await getOrRefreshEnvironmentVariables();
      const secret = options.envSecret || vars.FOREST_ENV_SECRET;

      if (!secret) {
        throw new BusinessError(
          'Your forest env secret is missing.' +
            ' Please provide it with the `bootstrap --env-secret <your-secret-key>` command or' +
            ' add it to your .env file or in environment variables.',
        );
      }

      const forestServer = buildHttpForestServer({ ...vars, FOREST_ENV_SECRET: secret });
      spinner.succeed('Environment found.');
      spinner.stop();

      if (!(await askToOverwriteCustomizations(forestServer))) {
        throw new BusinessError('Operation aborted.');
      }

      spinner.text = 'Boostrapping project\n';
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
    actionRunner(async spinner => {
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
    actionRunner(async spinner => {
      const vars = await getOrRefreshEnvironmentVariables();
      validateEnvironmentVariables(vars);
      const forestServer = buildHttpForestServer(vars);
      spinner.stop();

      if (!(await askToOverwriteCustomizations(forestServer))) {
        throw new BusinessError('Operation aborted.');
      }

      spinner.text = 'Publishing code customizations\n';
      spinner.start();
      await publish(forestServer);
      spinner.succeed('Code customizations published');
    }),
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
