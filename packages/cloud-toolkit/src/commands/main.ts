#!/usr/bin/env node

import { program } from 'commander';

import bootstrap from './bootstrap';
import generateOrUpdateTypings from '../services/typings-updater';

program
  .command('update-typings')
  .description('Update your typings file to synchronize with your datasource')
  .action(async () => generateOrUpdateTypings());

program
  .command('bootstrap')
  .description('Bootstrap your project')
  .action(() => bootstrap());

program.parse();
