#!/usr/bin/env node

import { program } from 'commander';

import bootstrap from './bootstrap';
import login from './login';
import generateOrUpdateTypings from '../services/typings-updater';

program
  .command('update-typings')
  .description('Update your typings file to synchronize with your datasource')
  .action(generateOrUpdateTypings);

program
  .command('bootstrap')
  .description('Bootstrap your project')
  .action(async () => {
    await bootstrap();
    await login();
  });

program.command('login').description('Login to your project').action(login);

program.parse();
