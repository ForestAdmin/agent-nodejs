import fsSync from 'fs';
import ora from 'ora';
import os from 'os';
import path from 'path';

import login from './login';
import makeCommands from './make-commands';
import BootstrapPathManager from './services/bootstrap-path-manager';
import DistPathManager from './services/dist-path-manager';
import { getEnvironmentVariables } from './services/environment-variables';
import EventSubscriber from './services/event-subscriber';
import HttpServer from './services/http-server';
import { EnvironmentVariables, Logger } from './types';

const loggerPrefix = {
  Debug: '\x1b[34mdebug:\x1b[0m',
  Info: '\x1b[32minfo:\x1b[0m',
  Warn: '\x1b[33mwarning:\x1b[0m',
  Error: '\x1b[31merror:\x1b[0m',
};

const buildHttpServer = (envs: EnvironmentVariables): HttpServer => {
  return new HttpServer(envs.FOREST_SERVER_URL, envs.FOREST_ENV_SECRET, envs.FOREST_AUTH_TOKEN);
};

const buildEventSubscriber = (envs: EnvironmentVariables): EventSubscriber => {
  return new EventSubscriber(envs.FOREST_SUBSCRIPTION_URL, envs.FOREST_AUTH_TOKEN);
};

const logger: Logger = {
  spinner: ora(),
  log: (text?: string) => process.stdout.write(text),
  info: (text?: string) => process.stdout.write(`${loggerPrefix.Info} ${text}`),
  error: (text?: string) => process.stdout.write(`${loggerPrefix.Error} ${text}`),
  warn: (text?: string) => process.stdout.write(`${loggerPrefix.Warn} ${text}`),
  debug: (text?: string) => process.stdout.write(`${loggerPrefix.Debug} ${text}`),
};

function getCurrentVersion() {
  const { version } = JSON.parse(
    fsSync.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'),
  );

  return version;
}

export default function buildCommands() {
  return makeCommands({
    getEnvironmentVariables,
    buildHttpServer,
    buildEventSubscriber,
    login,
    logger,
    getCurrentVersion,
    bootstrapPathManager: new BootstrapPathManager(os.tmpdir(), os.homedir()),
    distPathManager: new DistPathManager(),
  });
}
