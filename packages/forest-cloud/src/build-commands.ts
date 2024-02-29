import fsSync from 'fs';
import os from 'os';
import path from 'path';

import createLogger from './logger';
import login from './login';
import makeCommands from './make-commands';
import BootstrapPathManager from './services/bootstrap-path-manager';
import DistPathManager from './services/dist-path-manager';
import { getEnvironmentVariables } from './services/environment-variables';
import EventSubscriber from './services/event-subscriber';
import HttpServer from './services/http-server';
import { EnvironmentVariables } from './types';

const buildHttpServer = (envs: EnvironmentVariables): HttpServer => {
  return new HttpServer(envs.FOREST_SERVER_URL, envs.FOREST_ENV_SECRET, envs.FOREST_AUTH_TOKEN);
};

const buildEventSubscriber = (envs: EnvironmentVariables): EventSubscriber => {
  return new EventSubscriber(envs.FOREST_SUBSCRIPTION_URL, envs.FOREST_AUTH_TOKEN);
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
    logger: createLogger(),
    getCurrentVersion,
    bootstrapPathManager: new BootstrapPathManager(os.tmpdir(), os.homedir()),
    distPathManager: new DistPathManager(),
  });
}
