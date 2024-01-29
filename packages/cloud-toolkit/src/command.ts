#!/usr/bin/env node

import { program } from 'commander';

import bootstrap from './services/bootstrap';
import login from './services/login';
import updateTypings from './services/update-typings';

program
  .command('update-typings')
  .description('Update your typings file to synchronize with your datasource')
  .action(updateTypings);

program
  .command('bootstrap')
  .description('Bootstrap your project')
  .action(async () => {
    console.log('ok');
  });

program.command('login').description('Login to your project').action(login);

program.parse();
