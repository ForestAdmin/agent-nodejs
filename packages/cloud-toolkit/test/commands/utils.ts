import os from 'os';

import BootstrapPathManager from '../../src/services/bootstrap-path-manager';
import DistPathManager from '../../src/services/dist-path-manager';
import HttpServer from '../../src/services/http-server';
import { EnvironmentVariables, MakeCommands } from '../../src/types';

export type MakeCommandsForTests = Omit<MakeCommands, 'spinner'>;

// eslint-disable-next-line import/prefer-default-export
export const setupCommandArguments = (
  options?: Partial<{
    getLastPublishedCodeDetails: jest.Mock;
    getEnvironmentVariables: jest.Mock;
    login: jest.Mock;
    getIntrospection: jest.Mock;
  }>,
): MakeCommandsForTests => {
  const getEnvironmentVariables =
    options?.getEnvironmentVariables ||
    jest.fn().mockResolvedValue({
      FOREST_AUTH_TOKEN: 'forest-auth-token',
      FOREST_SERVER_URL: 'https://api.forestadmin.com',
      FOREST_SUBSCRIPTION_URL: 'wss://api.forestadmin.com/subscriptions',
    });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const buildHttpServer = (vars: EnvironmentVariables) => {
    return {
      getIntrospection: options?.getIntrospection || jest.fn(),
      postUploadRequest: jest.fn(),
      getLastPublishedCodeDetails: options?.getLastPublishedCodeDetails || jest.fn(),
      postPublish: jest.fn(),
    } as unknown as HttpServer;
  };

  const buildEventSubscriber = jest.fn();
  const login = options?.login || jest.fn();

  return {
    getEnvironmentVariables,
    buildHttpServer,
    buildEventSubscriber,
    login,
    distPathManager: new DistPathManager(os.tmpdir()),
    bootstrapPathManager: new BootstrapPathManager(os.tmpdir(), os.tmpdir(), os.tmpdir()),
  };
};
