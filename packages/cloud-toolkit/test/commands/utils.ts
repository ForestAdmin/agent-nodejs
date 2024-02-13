import HttpServer from '../../src/services/http-server';
import { EnvironmentVariables, MakeCommands } from '../../src/types';

export type MakeCommandsForTests = Pick<
  MakeCommands,
  | 'getOrRefreshEnvironmentVariables'
  | 'getEnvironmentVariables'
  | 'buildHttpServer'
  | 'buildEventSubscriber'
  | 'login'
>;

// eslint-disable-next-line import/prefer-default-export
export const setupCommandArguments = (
  options?: Partial<{
    getLastPublishedCodeDetails: jest.Mock;
    getOrRefreshEnvironmentVariables: jest.Mock;
    getEnvironmentVariables: jest.Mock;
    login: jest.Mock;
  }>,
): MakeCommandsForTests => {
  const getOrRefreshEnvironmentVariables = options?.getOrRefreshEnvironmentVariables || jest.fn();
  const getEnvironmentVariables = options?.getEnvironmentVariables || jest.fn();

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
  const login = options?.login || jest.fn();

  return {
    getOrRefreshEnvironmentVariables,
    getEnvironmentVariables,
    buildHttpServer,
    buildEventSubscriber,
    login,
  };
};
