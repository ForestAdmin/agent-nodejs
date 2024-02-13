#!/usr/bin/env node

import { configDotenv } from 'dotenv';
import ora from 'ora';
import os from 'os';

import login from './login';
import makeCommands from './make-commands';
import BootstrapPathManager from './services/bootstrap-path-manager';
import {
  getEnvironmentVariables,
  validateEnvironmentVariables,
} from './services/environment-variables';
import EventSubscriber from './services/event-subscriber';
import HttpServer from './services/http-server';
import { EnvironmentVariables } from './types';

configDotenv();

const buildHttpServer = (envs: EnvironmentVariables): HttpServer => {
  validateEnvironmentVariables(envs);

  return new HttpServer(envs.FOREST_SERVER_URL, envs.FOREST_ENV_SECRET, envs.FOREST_AUTH_TOKEN);
};

const buildEventSubscriber = (envs: EnvironmentVariables): EventSubscriber => {
  validateEnvironmentVariables(envs);

  return new EventSubscriber(envs.FOREST_SUBSCRIPTION_URL, envs.FOREST_AUTH_TOKEN);
};

const command = makeCommands({
  getEnvironmentVariables,
  buildHttpServer,
  buildEventSubscriber,
  login,
  buildSpinner: () => ora(),
  buildBootstrapPathManager: () => new BootstrapPathManager(os.tmpdir(), os.homedir()),
});

command.parseAsync();
