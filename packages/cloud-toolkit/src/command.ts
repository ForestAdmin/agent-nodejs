#!/usr/bin/env node

import { program } from 'commander';
import { configDotenv } from 'dotenv';

import bootstrap from './services/bootstrap';
import {
  getEnvironmentVariables,
  validateEnvironmentVariables,
} from './services/environment-variables';
import HttpForestServer from './services/http-forest-server';
import login from './services/login';
import updateTypings from './services/update-typings';

configDotenv();

const buildHttpForestServer = async () => {
  const vars = await getEnvironmentVariables();
  validateEnvironmentVariables(vars);

  return new HttpForestServer(
    vars.FOREST_SERVER_URL,
    vars.FOREST_ENV_SECRET,
    vars.FOREST_AUTH_TOKEN,
  );
};

program
  .command('update-typings')
  .description(
    'Update your typings file to synchronize code autocompletion with your datasource ' +
      '(whenever its schema changes)',
  )
  .action(async () => {
    if (!(await getEnvironmentVariables()).FOREST_AUTH_TOKEN) await login();
    await updateTypings(await buildHttpForestServer());
  });

program
  .command('bootstrap')
  .description('Bootstrap your project')
  .argument(
    '<Environment secret>',
    'Environment secret, you can find it in your environment settings',
  )
  .action(async (envSecret: string) => {
    await bootstrap(envSecret);
    if (!(await getEnvironmentVariables()).FOREST_AUTH_TOKEN) await login();
    await updateTypings(await buildHttpForestServer());
  });

program.command('login').description('Login to your project').action(login);

program.parse();
