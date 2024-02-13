import * as fs from 'fs';
import * as fsPromises from 'node:fs/promises';
import os from 'node:os';

import { getEnvironmentVariables } from '../../src/services/environment-variables';

jest.mock('os');
jest.mock('node:fs/promises');
jest.mock('fs');

jest.spyOn(os, 'homedir').mockReturnValue('/home/foo');
jest.spyOn(fsPromises, 'readFile').mockResolvedValue('the-token-from-file');
jest.spyOn(fs, 'existsSync').mockReturnValue(true);

describe('environment-variables', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getEnvironmentVariables', () => {
    describe('if all vars are provided by env', () => {
      it('should provide the variables if present', async () => {
        process.env.FOREST_ENV_SECRET = 'abc';
        process.env.FOREST_SERVER_URL = 'https://the.forest.server.url';
        process.env.FOREST_AUTH_TOKEN = 'tokenAbc123';
        process.env.FOREST_SUBSCRIPTION_URL = 'wss://the.forest.subs.url';
        expect(await getEnvironmentVariables()).toEqual({
          FOREST_AUTH_TOKEN: 'tokenAbc123',
          FOREST_ENV_SECRET: 'abc',
          FOREST_SERVER_URL: 'https://the.forest.server.url',
          FOREST_SUBSCRIPTION_URL: 'wss://the.forest.subs.url',
        });
      });
    });
    describe('if FOREST_AUTH_TOKEN is missing', () => {
      it('should retrieve from file at TOKEN_PATH', async () => {
        process.env.FOREST_AUTH_TOKEN = '';
        process.env.TOKEN_PATH = '/my/token/path';
        const b = await getEnvironmentVariables();
        expect(b).toMatchObject({
          FOREST_AUTH_TOKEN: 'the-token-from-file',
        });
        expect(fsPromises.readFile).toHaveBeenCalledTimes(1);
        expect(fsPromises.readFile).toHaveBeenCalledWith(
          '/my/token/path/.forest.d/.forestrc',
          'utf8',
        );
      });
      it('should retrieve from homedir file if TOKEN_PATH missing', async () => {
        process.env.FOREST_AUTH_TOKEN = '';
        process.env.TOKEN_PATH = '';
        expect(await getEnvironmentVariables()).toMatchObject({
          FOREST_AUTH_TOKEN: 'the-token-from-file',
        });
        expect(os.homedir).toHaveBeenCalledTimes(1);
        expect(fsPromises.readFile).toHaveBeenCalledTimes(1);
        expect(fsPromises.readFile).toHaveBeenCalledWith('/home/foo/.forest.d/.forestrc', 'utf8');
      });
    });
    describe('if FOREST_SERVER_URL and FOREST_SUBSCRIPTION_URL are missing', () => {
      it('should use sane default', async () => {
        process.env.FOREST_SERVER_URL = '';
        process.env.FOREST_SUBSCRIPTION_URL = '';
        expect(await getEnvironmentVariables()).toMatchObject({
          FOREST_SERVER_URL: 'https://api.forestadmin.com',
          FOREST_SUBSCRIPTION_URL: 'wss://api.forestadmin.com/subscriptions',
        });
      });
    });
  });
});
