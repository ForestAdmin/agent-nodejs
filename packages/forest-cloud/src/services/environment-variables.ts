import type { EnvironmentVariables } from '../types';

import * as fs from 'fs';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'path';

import { BusinessError } from '../errors';

const getTokenFromToolbelt = async (baseTokenPath: string): Promise<string | null> => {
  const tokenPath = path.join(baseTokenPath, '.forest.d', '.forestrc');

  if (fs.existsSync(tokenPath)) return readFile(tokenPath, 'utf8');

  return null;
};

export const defaultEnvs = Object.freeze({
  FOREST_SERVER_URL: 'https://api.forestadmin.com',
  FOREST_SUBSCRIPTION_URL: 'wss://api.forestadmin.com/subscriptions',
  NODE_TLS_REJECT_UNAUTHORIZED: '1',
  TOKEN_PATH: homedir(),
});

export async function getEnvironmentVariables(): Promise<EnvironmentVariables> {
  const tokenPath = process.env.TOKEN_PATH || defaultEnvs.TOKEN_PATH;

  const FOREST_SERVER_URL =
    process.env.FOREST_SERVER_URL || process.env.FOREST_URL || defaultEnvs.FOREST_SERVER_URL;

  let FOREST_SUBSCRIPTION_URL;

  if (FOREST_SERVER_URL !== defaultEnvs.FOREST_SERVER_URL && !process.env.FOREST_SUBSCRIPTION_URL) {
    // for lumberjacks: if FOREST_SERVER_URL is not default, we can guess the subscription url
    FOREST_SUBSCRIPTION_URL = `${FOREST_SERVER_URL.replace(/^https?:\/\//, 'wss://').replace(
      /\/$/,
      '',
    )}/subscriptions`;
  } else {
    FOREST_SUBSCRIPTION_URL =
      process.env.FOREST_SUBSCRIPTION_URL || defaultEnvs.FOREST_SUBSCRIPTION_URL;
  }

  return {
    FOREST_ENV_SECRET: process.env.FOREST_ENV_SECRET,
    TOKEN_PATH: tokenPath,
    FOREST_SERVER_URL,
    FOREST_SUBSCRIPTION_URL,
    FOREST_AUTH_TOKEN: process.env.FOREST_AUTH_TOKEN || (await getTokenFromToolbelt(tokenPath)),
    NODE_TLS_REJECT_UNAUTHORIZED:
      process.env.NODE_TLS_REJECT_UNAUTHORIZED || defaultEnvs.NODE_TLS_REJECT_UNAUTHORIZED,
  };
}

function validateUrl(url: string, variableName: string, protocols: string[]): void {
  if (!url) {
    throw new BusinessError(`Missing ${variableName}. Please check your .env file.`);
  }

  let givenUrl;

  try {
    givenUrl = new URL(url);
  } catch (err) {
    throw new BusinessError(
      `${variableName} is invalid. Please check your .env file.\n${err.message}`,
    );
  }

  if (!protocols.includes(givenUrl.protocol)) {
    throw new BusinessError(
      `${variableName} is invalid, it must start with '${protocols
        .map(protocol => `${protocol}//`)
        .join("' or '")}'. Please check your .env file.`,
    );
  }
}

export function validateServerUrl(serverUrl: string): void {
  validateUrl(serverUrl, 'FOREST_SERVER_URL', ['http:', 'https:']);
}

export function validateSubscriptionUrl(subscriptionUrl: string): void {
  validateUrl(subscriptionUrl, 'FOREST_SUBSCRIPTION_URL', ['wss:']);
}

export function validateMissingForestEnvSecret(
  forestEnvSecret: string,
  fromCommand: 'logs' | 'bootstrap',
): void {
  if (!forestEnvSecret) {
    throw new BusinessError(
      'Your forest env secret is missing.' +
        ` Please provide it with the \`${fromCommand} --env-secret <your-secret-key>\` command or` +
        ' add it to your .env file or in environment variables.',
    );
  }
}

export function validateEnvironmentVariables(env: EnvironmentVariables): void {
  if (!env.FOREST_ENV_SECRET) {
    throw new BusinessError('Missing FOREST_ENV_SECRET. Please check your .env file.');
  }

  if (typeof env.FOREST_ENV_SECRET !== 'string' || !/^[0-9a-f]{64}$/.test(env.FOREST_ENV_SECRET)) {
    throw new BusinessError(
      'FOREST_ENV_SECRET is invalid. Please check your .env file.\n\tYou can retrieve its value from environment settings on Forest Admin.',
    );
  }

  if (!env.FOREST_AUTH_TOKEN) {
    throw new BusinessError(
      'Missing authentication token. Your TOKEN_PATH is probably wrong on .env file.',
    );
  }

  validateServerUrl(env.FOREST_SERVER_URL);
  validateSubscriptionUrl(env.FOREST_SUBSCRIPTION_URL);
}
