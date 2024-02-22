import * as fs from 'fs';
import * as fsPromises from 'node:fs/promises';
import os from 'node:os';

import {
  getEnvironmentVariables,
  validateEnvironmentVariables,
  validateServerUrl,
  validateSubscriptionUrl,
} from '../../src/services/environment-variables';

jest.mock('os');
jest.mock('node:fs/promises');
jest.mock('fs');

describe('environment-variables', () => {
  beforeEach(() => {
    jest.spyOn(os, 'homedir').mockReturnValue('/home/foo');
    jest.spyOn(fsPromises, 'readFile').mockResolvedValue('the-token-from-file');
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.clearAllMocks();
  });

  describe('getEnvironmentVariables', () => {
    describe('if all vars are provided by env', () => {
      it('should provide the variables if present', async () => {
        process.env.FOREST_ENV_SECRET = 'abc';
        process.env.FOREST_SERVER_URL = 'https://the.forest.server.url';
        process.env.FOREST_AUTH_TOKEN = 'tokenAbc123';
        process.env.FOREST_SUBSCRIPTION_URL = 'wss://the.forest.subs.url';
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1';
        expect(await getEnvironmentVariables()).toEqual({
          FOREST_AUTH_TOKEN: 'tokenAbc123',
          FOREST_ENV_SECRET: 'abc',
          FOREST_SERVER_URL: 'https://the.forest.server.url',
          FOREST_SUBSCRIPTION_URL: 'wss://the.forest.subs.url',
          NODE_TLS_REJECT_UNAUTHORIZED: '1',
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

      describe('If there is no .forestrc', () => {
        it('should return FOREST_AUTH_TOKEN as null', async () => {
          // no .forestrc
          jest.spyOn(fs, 'existsSync').mockReturnValue(false);

          const b = await getEnvironmentVariables();
          expect(b).toMatchObject({ FOREST_AUTH_TOKEN: null });
        });
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

    describe('validateServerUrl', () => {
      describe('if the url is valid', () => {
        it('should not throw', () => {
          expect(() => validateServerUrl('https://test.com')).not.toThrow();
        });
      });

      describe('if no server url is provided', () => {
        it('should throw a specific error', () => {
          expect(() => validateServerUrl(undefined as unknown as string)).toThrow(
            'Missing FOREST_SERVER_URL. Please check your .env file.',
          );
        });
      });

      describe('if the string is not an url', () => {
        it('should throw a specific error', () => {
          expect(() => validateServerUrl('toto')).toThrow(
            `FOREST_SERVER_URL is invalid. Please check your .env file.\nInvalid URL`,
          );
        });
      });

      describe('if the protocol is wrong', () => {
        it('should throw a specific error', () => {
          expect(() => validateServerUrl('httpx://toto')).toThrow(
            `FOREST_SERVER_URL is invalid, it must start with 'http://' or 'https://'. Please check your .env file.`,
          );
        });
      });
    });

    describe('validateSubscription', () => {
      describe('if the url is valid', () => {
        it('should not throw', () => {
          expect(() => validateSubscriptionUrl('wss://test.com')).not.toThrow();
        });
      });

      describe('if no subscription url is provided', () => {
        it('should throw a specific error', () => {
          expect(() => validateSubscriptionUrl(undefined as unknown as string)).toThrow(
            'Missing FOREST_SUBSCRIPTION_URL. Please check your .env file.',
          );
        });
      });

      describe('if the string is not an url', () => {
        it('should throw a specific error', () => {
          expect(() => validateSubscriptionUrl('toto')).toThrow(
            `FOREST_SUBSCRIPTION_URL is invalid. Please check your .env file.\nInvalid URL`,
          );
        });
      });

      describe('if the protocol is wrong', () => {
        it('should throw a specific error', () => {
          expect(() => validateSubscriptionUrl('httpx://toto')).toThrow(
            `FOREST_SUBSCRIPTION_URL is invalid, it must start with 'wss://'. Please check your .env file.`,
          );
        });
      });
    });

    describe('validateEnvironmentVariables', () => {
      describe('if the FOREST_ENV_SECRET is missing', () => {
        test('it should throw a specific error', () => {
          expect(() =>
            validateEnvironmentVariables({
              FOREST_ENV_SECRET: '',
              FOREST_SERVER_URL: '',
              FOREST_SUBSCRIPTION_URL: '',
              FOREST_AUTH_TOKEN: '',
              NODE_TLS_REJECT_UNAUTHORIZED: '',
            }),
          ).toThrow('Missing FOREST_ENV_SECRET. Please check your .env file.');
        });
      });

      describe('if the FOREST_ENV_SECRET is a wrong format', () => {
        test('it should throw a specific error', () => {
          expect(() =>
            validateEnvironmentVariables({
              FOREST_ENV_SECRET: 'wrong-format',
              FOREST_SERVER_URL: '',
              FOREST_SUBSCRIPTION_URL: '',
              FOREST_AUTH_TOKEN: '',
              NODE_TLS_REJECT_UNAUTHORIZED: '',
            }),
          ).toThrow(
            // eslint-disable-next-line max-len
            'FOREST_ENV_SECRET is invalid. Please check your .env file.\n\tYou can retrieve its value from environment settings on Forest Admin.',
          );
        });
      });

      describe('if the FOREST_ENV_SECRET is not a string', () => {
        test('it should throw a specific error', () => {
          expect(() =>
            validateEnvironmentVariables({
              FOREST_ENV_SECRET: 123 as unknown as string,
              FOREST_SERVER_URL: '',
              FOREST_SUBSCRIPTION_URL: '',
              FOREST_AUTH_TOKEN: '',
              NODE_TLS_REJECT_UNAUTHORIZED: '',
            }),
          ).toThrow(
            // eslint-disable-next-line max-len
            'FOREST_ENV_SECRET is invalid. Please check your .env file.\n\tYou can retrieve its value from environment settings on Forest Admin.',
          );
        });
      });

      describe('if the FOREST_AUTH_TOKEN is missing', () => {
        test('it should throw a specific error', () => {
          expect(() =>
            validateEnvironmentVariables({
              FOREST_ENV_SECRET: 'a'.repeat(64),
              FOREST_SERVER_URL: '',
              FOREST_SUBSCRIPTION_URL: '',
              FOREST_AUTH_TOKEN: '',
              NODE_TLS_REJECT_UNAUTHORIZED: '',
            }),
          ).toThrow(
            'Missing authentication token. Your TOKEN_PATH is probably wrong on .env file.',
          );
        });
      });

      describe('if FOREST_SERVER_URL is missing', () => {
        test('it should delegate to validateServerUrl', () => {
          expect(() =>
            validateEnvironmentVariables({
              FOREST_ENV_SECRET: 'a'.repeat(64),
              FOREST_SERVER_URL: '',
              FOREST_SUBSCRIPTION_URL: '',
              FOREST_AUTH_TOKEN: 'a'.repeat(64),
              NODE_TLS_REJECT_UNAUTHORIZED: '',
            }),
          ).toThrow('Missing FOREST_SERVER_URL. Please check your .env file.');
        });
      });

      describe('if everything is correctly set', () => {
        test('it should not throw', () => {
          expect(() =>
            validateEnvironmentVariables({
              FOREST_ENV_SECRET: 'a'.repeat(64),
              FOREST_SERVER_URL: 'http://test.com',
              FOREST_SUBSCRIPTION_URL: 'wss://test.com',
              FOREST_AUTH_TOKEN: 'a'.repeat(64),
              NODE_TLS_REJECT_UNAUTHORIZED: '',
            }),
          ).not.toThrow();
        });
      });
    });
  });
});
