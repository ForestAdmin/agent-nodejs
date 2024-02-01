#!/usr/bin/env node

import { program } from 'commander';
import { configDotenv } from 'dotenv';

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
      spinner.text = 'Boostrapping project\n';
      const vars = await getOrRefreshEnvironmentVariables();
      const secret = options.envSecret || vars.FOREST_ENV_SECRET;

      if (!secret) {
        throw new BusinessError(
          'Your forest env secret is missing.' +
            ' Please provide it with the `bootstrap --env-secret <your-secret-key>` command or' +
            ' add it to your .env file or in environment variables.',
        );
      }

      await bootstrap(secret, buildHttpForestServer({ ...vars, FOREST_ENV_SECRET: secret }));

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
      spinner.text = 'Publishing code customizations\n';
      const vars = await getOrRefreshEnvironmentVariables();
      validateServerUrl(vars.FOREST_SERVER_URL);
      await publish(await buildHttpForestServer(vars));
      spinner.succeed('Code customizations published');
    }),
  );

program.parse();
