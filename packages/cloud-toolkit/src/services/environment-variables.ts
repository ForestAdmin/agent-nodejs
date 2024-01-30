import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'path';

import { EnvironmentVariables } from '../types';

const getToken = async (): Promise<string | null> => {
  const tokenPath = process.env.TOKEN_PATH || homedir();

  try {
    return await readFile(path.join(tokenPath, '.forest.d', '.forestrc'), 'utf8');
  } catch (error) {
    return null;
  }
};

export async function getEnvironmentVariables(): Promise<EnvironmentVariables> {
  return {
    FOREST_ENV_SECRET: process.env.FOREST_ENV_SECRET,
    FOREST_SERVER_URL: process.env.FOREST_SERVER_URL || 'https://api.forestadmin.com',
    FOREST_AUTH_TOKEN: await getToken(),
  };
}

export function validateEnvironmentVariables(env: EnvironmentVariables): void {
  if (!env.FOREST_ENV_SECRET) {
    throw new Error('Missing FOREST_ENV_SECRET. Please check your .env file.');
  }

  if (!env.FOREST_AUTH_TOKEN) {
    throw new Error(
      'Missing authentication token. Your TOKEN_PATH is probably wrong on .env file.',
    );
  }

  if (!env.FOREST_SERVER_URL) {
    throw new Error('Missing FOREST_SERVER_URL. Please check your .env file.');
  }
}
