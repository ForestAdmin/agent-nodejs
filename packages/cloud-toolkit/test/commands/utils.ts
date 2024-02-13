import os from 'os';

import BootstrapPathManager from '../../src/services/bootstrap-path-manager';
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
    options?.getEnvironmentVariables || jest.fn().mockResolvedValue({});

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
    bootstrapPathManager: new BootstrapPathManager(os.tmpdir(), os.tmpdir(), os.tmpdir()),
  };
};
