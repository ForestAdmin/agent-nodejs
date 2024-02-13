import HttpServer from '../../src/services/http-server';
import { EnvironmentVariables, MakeCommands } from '../../src/types';

// eslint-disable-next-line import/prefer-default-export
export const setupCommandArguments = (
  options?: Partial<{
    getLastPublishedCodeDetails: jest.Mock;
    getOrRefreshEnvironmentVariables: jest.Mock;
  }>,
): MakeCommands => {
  const getOrRefreshEnvironmentVariables = options?.getOrRefreshEnvironmentVariables || jest.fn();
  const getEnvironmentVariables = jest.fn();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const buildHttpServer = (vars: EnvironmentVariables) => {
    return {
      getIntrospection: jest.fn(),
      postUploadRequest: jest.fn(),
      getLastPublishedCodeDetails: options?.getLastPublishedCodeDetails || jest.fn(),
      postPublish: jest.fn(),
    } as unknown as HttpServer;
  };

  const buildEventSubscriber = jest.fn();
  const login = jest.fn();

  return {
    getOrRefreshEnvironmentVariables,
    getEnvironmentVariables,
    buildHttpServer,
    buildEventSubscriber,
    login,
  };
};
