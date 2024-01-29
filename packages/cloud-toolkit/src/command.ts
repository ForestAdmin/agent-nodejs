#!/usr/bin/env node

import { program } from 'commander';
import { configDotenv } from 'dotenv';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'path';

import bootstrap from './services/bootstrap';
import HttpForestServer from './services/http-forest-server';
import login from './services/login';
import updateTypings from './services/update-typings';

configDotenv();

const buildHttpForestServer = async () => {
  if (!process.env.FOREST_SERVER_URL || !process.env.FOREST_SECRET_KEY || !process.env.TOKEN_PATH) {
    throw new Error(
      'Missing FOREST_SERVER_URL, FOREST_SECRET_KEY or TOKEN_PATH. Please check your .env file.',
    );
  }

  return new HttpForestServer(
    process.env.FOREST_SERVER_URL,
    process.env.FOREST_ENV_SECRET,
    await readFile(process.env.TOKEN_PATH as string, 'utf8'),
  );
};

program
  .command('update-typings')
  .description('Update your typings file to synchronize with your datasource')
  .action(async () => {
    await updateTypings(await buildHttpForestServer());
  });

program
  .command('bootstrap')
  .description('Bootstrap your project')
  .action(async () => {
    await bootstrap();
    await login();
    await updateTypings(await buildHttpForestServer());
  });

program.command('login').description('Login to your project').action(login);

program.parse();
