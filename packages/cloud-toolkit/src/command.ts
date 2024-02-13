#!/usr/bin/env node

import { configDotenv } from 'dotenv';
import os from 'os';

import makeCommands from './make-commands';
import {
  getEnvironmentVariables,
  getOrRefreshEnvironmentVariables,
  validateEnvironmentVariables,
} from './services/environment-variables';
import EventSubscriber from './services/event-subscriber';
import HttpServer from './services/http-server';
import login from './services/login';
import packageCustomizations from './services/packager';
import PathManager from './services/path-manager';
import publish from './services/publish';
import { updateTypingsWithCustomizations } from './services/update-typings';
import { EnvironmentVariables } from './types';

configDotenv();

const buildHttpForestServer = (envs: EnvironmentVariables): HttpServer => {
  validateEnvironmentVariables(envs);

  return new HttpServer(envs.FOREST_SERVER_URL, envs.FOREST_ENV_SECRET, envs.FOREST_AUTH_TOKEN);
};

const buildEventSubscriber = (envs: EnvironmentVariables): EventSubscriber => {
  validateEnvironmentVariables(envs);

  return new EventSubscriber(envs.FOREST_SUBSCRIPTION_URL, envs.FOREST_AUTH_TOKEN);
};

const command = makeCommands({
  getOrRefreshEnvironmentVariables,
  getEnvironmentVariables,
  buildHttpForestServer,
  buildEventSubscriber,
  login,
});

command.parseAsync();
