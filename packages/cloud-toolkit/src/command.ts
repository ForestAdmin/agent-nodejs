#!/usr/bin/env node

import { program } from 'commander';
import { configDotenv } from 'dotenv';

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

program
  .command('update-typings')
  .description(
    'Update your typings file to synchronize code autocompletion with your datasource ' +
      '(whenever its schema changes)',
  )
  .action(async () => {
    const vars = await getEnvironmentVariables();
    if (!vars.FOREST_AUTH_TOKEN) await login();
    await updateTypings(await buildHttpForestServer(vars));
  });

program
  .command('bootstrap')
  .description('Bootstrap your project')
  .argument(
    '<Environment secret>',
    'Environment secret, you can find it in your environment settings',
  )
  .action(async (envSecret: string) => {
    const vars = await getEnvironmentVariables();
    if (!vars.FOREST_AUTH_TOKEN) await login();
    const secret = envSecret || vars.FOREST_ENV_SECRET;
    await bootstrap(secret);
    await updateTypings(await buildHttpForestServer({ ...vars, FOREST_ENV_SECRET: secret }));
  });

program
  .command('login')
  .description('Login to your project')
  .action(async () => {
    const vars = await getEnvironmentVariables();
    validateServerUrl(vars.FOREST_SERVER_URL);
    await login();
  });

program.parse();
