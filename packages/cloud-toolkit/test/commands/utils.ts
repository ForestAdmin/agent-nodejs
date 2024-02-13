import HttpForestServer from '../../src/services/http-forest-server';
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
  const buildHttpForestServer = (vars: EnvironmentVariables) => {
    return {
      getIntrospection: jest.fn(),
      postUploadRequest: jest.fn(),
      getLastPublishedCodeDetails: options?.getLastPublishedCodeDetails || jest.fn(),
      postPublish: jest.fn(),
    } as unknown as HttpForestServer;
  };

  const buildEventSubscriber = jest.fn();

  return {
    getOrRefreshEnvironmentVariables,
    getEnvironmentVariables,
    buildHttpForestServer,
    buildEventSubscriber,
  };
};
