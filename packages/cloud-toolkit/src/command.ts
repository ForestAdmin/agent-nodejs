#!/usr/bin/env node

import { configDotenv } from 'dotenv';

import makeCommands from './make-commands';
import {
  getEnvironmentVariables,
  getOrRefreshEnvironmentVariables,
  validateEnvironmentVariables,
} from './services/environment-variables';
import EventSubscriber from './services/event-subscriber';
import HttpForestServer from './services/http-forest-server';
import { EnvironmentVariables } from './types';

configDotenv();

const buildHttpForestServer = (envs: EnvironmentVariables): HttpForestServer => {
  validateEnvironmentVariables(envs);

  return new HttpForestServer(
    envs.FOREST_SERVER_URL,
    envs.FOREST_ENV_SECRET,
    envs.FOREST_AUTH_TOKEN,
  );
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
});

command.parseAsync();
