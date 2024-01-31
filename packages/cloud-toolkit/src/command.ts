#!/usr/bin/env node

import { program } from 'commander';
import { configDotenv } from 'dotenv';
import ora from 'ora';
import path from 'path';

import { BusinessError } from './errors';
import bootstrap from './services/bootstrap';
import {
  getEnvironmentVariables,
  validateEnvironmentVariables,
  validateServerUrl,
} from './services/environment-variables';
import HttpForestServer from './services/http-forest-server';
import login from './services/login';
import updateTypings from './services/update-typings';
import { EnvironmentVariables } from './types';

configDotenv();

const buildHttpForestServer = async (envs: EnvironmentVariables) => {
  validateEnvironmentVariables(envs);

  return new HttpForestServer(
    envs.FOREST_SERVER_URL,
    envs.FOREST_ENV_SECRET,
    envs.FOREST_AUTH_TOKEN,
  );
};

function actionRunner(fn: (...args) => Promise<any>) {
  return async (...args) => {
    const spinner = ora().start();

    try {
      await fn(spinner, ...args);
    } catch (e) {
      spinner.stop();
      const error: Error = e;

      if (error instanceof BusinessError) {
        console.error(`❌ ${error.message}`);
      } else {
        throw error;
      }
    }
  };
}

program
  .command('update-typings')
  .description(
    'Update your typings file to synchronize code autocompletion with your datasource ' +
      '(whenever its schema changes)',
  )
  .action(
    actionRunner(async spinner => {
      spinner.text = 'Updating typings\n';
      const vars = await getEnvironmentVariables();
      if (!vars.FOREST_AUTH_TOKEN) await login();
      await updateTypings(await buildHttpForestServer(vars), 'typings.d.ts');
      spinner.stop();
      console.log('✅ Your typings have been updated. \n');
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
      const vars = await getEnvironmentVariables();
      if (!vars.FOREST_AUTH_TOKEN) await login();
      const secret = options.envSecret || vars.FOREST_ENV_SECRET;

      if (!secret) {
        throw new BusinessError(
          'Your forest env secret is missing.' +
            ' Please provide it with the `bootstrap --env-secret <your-secret-key>` command or' +
            ' add it to your .env file or in environment variables.',
        );
      }

      await bootstrap(secret);
      await updateTypings(
        await buildHttpForestServer({ ...vars, FOREST_ENV_SECRET: secret }),
        path.join('cloud-customizer', 'typings.d.ts'),
      );
      spinner.stop();
      console.log(
        '✅ Project successfully bootstrapped. You can start creating your customizations! \n',
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
      spinner.stop();
      console.log('✅ You are logged in. \n');
    }),
  );

program.parse();
