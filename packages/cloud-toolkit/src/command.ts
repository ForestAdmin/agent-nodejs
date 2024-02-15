#!/usr/bin/env node

import { configDotenv } from 'dotenv';
import ora from 'ora';
import os from 'os';

import login from './login';
import makeCommands from './make-commands';
import BootstrapPathManager from './services/bootstrap-path-manager';
import DistPathManager from './services/dist-path-manager';
import { getEnvironmentVariables } from './services/environment-variables';
import EventSubscriber from './services/event-subscriber';
import HttpServer from './services/http-server';
import { EnvironmentVariables } from './types';

configDotenv();

const buildHttpServer = (envs: EnvironmentVariables): HttpServer => {
  return new HttpServer(envs.FOREST_SERVER_URL, envs.FOREST_ENV_SECRET, envs.FOREST_AUTH_TOKEN);
};

const buildEventSubscriber = (envs: EnvironmentVariables): EventSubscriber => {
  return new EventSubscriber(envs.FOREST_SUBSCRIPTION_URL, envs.FOREST_AUTH_TOKEN);
};

const spinner = {
  start: (text?: string) => ora().start(text),
  succeed: (text?: string) => ora().succeed(text),
  warn: (text?: string) => ora().warn(text),
  info: (text?: string) => ora().info(text),
  fail: (text?: string) => ora().fail(text),
  // eslint-disable-next-line no-console
  log: (text?: string) => console.log(text),
  stop: () => ora().stop(),
};

const command = makeCommands({
  getEnvironmentVariables,
  buildHttpServer,
  buildEventSubscriber,
  login,
  spinner,
  bootstrapPathManager: new BootstrapPathManager(os.tmpdir(), os.homedir()),
  distPathManager: new DistPathManager(),
});

command.parseAsync();
