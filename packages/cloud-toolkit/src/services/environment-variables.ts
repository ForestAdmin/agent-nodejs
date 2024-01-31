import * as fs from 'fs';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'path';

import login from './login';
import { BusinessError } from '../errors';
import { EnvironmentVariables } from '../types';

const getToken = async (): Promise<string | null> => {
  const baseTokenPath = process.env.TOKEN_PATH || homedir();
  const tokenPath = path.join(baseTokenPath, '.forest.d', '.forestrc');

  if (fs.existsSync(tokenPath)) return readFile(tokenPath, 'utf8');

  return null;
};

async function getEnvironmentVariables(): Promise<EnvironmentVariables> {
  return {
    FOREST_ENV_SECRET: process.env.FOREST_ENV_SECRET,
    FOREST_SERVER_URL: process.env.FOREST_SERVER_URL || 'https://api.forestadmin.com',
    FOREST_AUTH_TOKEN: await getToken(),
  };
}

export function validateServerUrl(serverUrl: string): void {
  if (!serverUrl) {
    throw new BusinessError('Missing FOREST_SERVER_URL. Please check your .env file.');
  }

  let givenUrl;

  try {
    givenUrl = new URL(serverUrl);
  } catch (err) {
    throw new BusinessError(
      `FOREST_SERVER_URL is invalid. Please check your .env file.' +
        ' You can probably remove it from your .env file.: ${err.message}`,
    );
  }

  if (!['http:', 'https:'].includes(givenUrl.protocol)) {
    throw new BusinessError(
      'FOREST_SERVER_URL is invalid, it must start with http:// or https://. Please check your .env file.',
    );
  }
}

export function validateEnvironmentVariables(env: EnvironmentVariables): void {
  if (!env.FOREST_ENV_SECRET) {
    throw new BusinessError('Missing FOREST_ENV_SECRET. Please check your .env file.');
  }

  if (typeof env.FOREST_ENV_SECRET !== 'string' || !/^[0-9a-f]{64}$/.test(env.FOREST_ENV_SECRET)) {
    throw new BusinessError(
      'FOREST_ENV_SECRET is invalid. Please check your .env file.' +
        ' You can retrieve its value from environment settings on Forest Admin.',
    );
  }

  if (!env.FOREST_AUTH_TOKEN) {
    throw new BusinessError(
      'Missing authentication token. Your TOKEN_PATH is probably wrong on .env file.',
    );
  }

  validateServerUrl(env.FOREST_SERVER_URL);
}

export const getOrRefreshEnvironmentVariables = async (): Promise<EnvironmentVariables> => {
  let vars = await getEnvironmentVariables();

  if (!vars.FOREST_AUTH_TOKEN) {
    await login();
    vars = await getEnvironmentVariables();
  }

  return vars;
};
