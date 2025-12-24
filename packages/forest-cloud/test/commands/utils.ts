import type { EnvironmentVariables, MakeCommands } from '../../src/types';

import fs from 'fs';
import os from 'os';
import path from 'path';

import BootstrapPathManager from '../../src/services/bootstrap-path-manager';
import DistPathManager from '../../src/services/dist-path-manager';
import HttpServer from '../../src/services/http-server';

export type MakeCommandsForTests = Omit<MakeCommands, 'logger'>;
const presignedPost = {
  url: 'https://s3.eu-west-3.amazonaws.com/forestadmin-platform-cloud-customization-test',
  fields: {
    bucket: 'forestadmin-platform-cloud-customization-test',
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': 'AKI?../request',
    'X-Amz-Date': '20240116T091247Z',
    Policy: `eyJleHBpcmF0aW9uIjoiMjAyNC0wMS0yM1QxMTowNzowNVoiLCJjb25kaXRpb25zIjpbeyJidWNrZXQiOiJ
        mb3Jlc3RhZG1pbi1wbGF0Zm9ybS1jbG91ZC1jdXN0b21pemF0aW9uLXRlc3QtdzEifSxbInN0YXJ0cy13aXRoIiwiJ
        GtleSIsImNsb3VkXzc2L2NvZGVfY3VzdG9taXphdGlvbi56aXAiXSxbImNvbnRlbnQtbGVuZ3RoLXJhbmdlIiwwLDE
        wNDg1NzYwXSx7ImJ1Y2tldCI6ImZvcmVzdGFkbWluLXBsYXRmb3JtLWNsb3VkLWN1c3RvbWl6YXRpb24tdGVzdC13M
        SJ9LHsiWC1BbXotQWxnb3JpdGhtIjoiQVdTNC1ITUFDLVNIQTI1NiJ9LHsiWC1BbXotQ3JlZGVudGlhbCI6IkFLSUF
        VUkVWSUNSQ0FBSkJDUDVFLzIwMjQwMTIzL2V1LXdlc3QtMS9zMy9hd3M0X3JlcXVlc3QifSx7IlgtQW16LURhdGUiO
        iIyMDI0MDEyM1QxMTAyMDVaIn1dfQ==`,
    'X-Amz-Signature': 'c5...84',
  },
};

export const environmentVariables = {
  FOREST_AUTH_TOKEN: 'forest-auth-token',
  FOREST_SERVER_URL: 'https://api.forestadmin.com',
  FOREST_SUBSCRIPTION_URL: 'wss://api.forestadmin.com/subscriptions',
  FOREST_ENV_SECRET: '63f51525814bdfec9dd99690a656757e251770c34549c5f383d909f5cce41eb9',
};

// eslint-disable-next-line import/prefer-default-export
export const setupCommandArguments = (
  options?: Partial<{
    getLastPublishedCodeDetails: jest.Mock;
    getEnvironmentVariables: jest.Mock;
    login: jest.Mock;
    getDatasources: jest.Mock;
    subscribeToCodeCustomization: jest.Mock;
    generateDatasourceConfigFile: jest.Mock;
    getLatestVersion: jest.Mock;
    getCurrentVersion: jest.Mock;
    getLogs: jest.Mock;
  }>,
): MakeCommandsForTests => {
  const getCurrentVersionMock = jest.fn().mockReturnValue('1.0.0');
  const getCurrentVersion = options?.getCurrentVersion || getCurrentVersionMock;
  const generateDatasourceConfigFile = options?.generateDatasourceConfigFile || jest.fn();
  const getEnvironmentVariables =
    options?.getEnvironmentVariables || jest.fn().mockResolvedValue(environmentVariables);

  const getOrCreateNewDevelopmentEnvironment = jest.fn().mockResolvedValue({
    data: {
      attributes: {
        secret_key: 'a784f885c9de4fdfc9cc953659bf6264e60a76e48e8c4af0956aef8f56c6650d',
      },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const buildHttpServer = (vars?: EnvironmentVariables) => {
    return {
      getDatasources: options?.getDatasources || jest.fn().mockResolvedValue([]),
      postUploadRequest: jest.fn().mockResolvedValue(presignedPost),
      getLastPublishedCodeDetails: options?.getLastPublishedCodeDetails || jest.fn(),
      postPublish: jest.fn().mockResolvedValue({ subscriptionId: 'aSubscriptionId' }),
      getLogs: options?.getLogs || jest.fn(),
      getOrCreateNewDevelopmentEnvironment,
    } as unknown as HttpServer;
  };

  HttpServer.getLatestVersion = options?.getLatestVersion || getCurrentVersionMock;

  const buildEventSubscriber = jest.fn().mockReturnValue({
    destroy: jest.fn(),
    subscribeToCodeCustomization:
      options?.subscribeToCodeCustomization || jest.fn().mockReturnValue({ error: undefined }),
  });
  const login = options?.login || jest.fn();

  const tmpdir = path.join(os.tmpdir(), (Math.floor(Math.random() * 100000) + 1).toString());

  try {
    fs.mkdirSync(tmpdir);
  } catch (err) {
    // clean the tmpdir if it exists
    fs.rmSync(tmpdir, { recursive: true });
    fs.mkdirSync(tmpdir);
  }

  return {
    getEnvironmentVariables,
    buildHttpServer,
    buildEventSubscriber,
    login,
    getCurrentVersion,
    generateDatasourceConfigFile,
    distPathManager: new DistPathManager(tmpdir),
    bootstrapPathManager: new BootstrapPathManager(tmpdir, tmpdir, tmpdir),
  };
};
