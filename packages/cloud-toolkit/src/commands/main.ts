#!/usr/bin/env node

import { program } from 'commander';

import generateOrUpdateTypings from '../services/typings-updater';

program
  .command('update-typings')
  .description('Update your typings file to synchronize with your datasource')
  .action(async () => generateOrUpdateTypings());

program.parse();
