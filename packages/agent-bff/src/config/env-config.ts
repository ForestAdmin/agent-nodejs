import { z } from 'zod';

import DEFAULT_BFF_PORT from '../defaults';
import { ConfigurationError } from '../errors';

export const REQUIRED_KEYS = [
  'FOREST_AUTH_SECRET',
  'FOREST_ENV_SECRET',
  'FOREST_SERVER_URL',
  'FOREST_APP_URL',
  'AGENT_URL',
] as const;

export type RequiredKey = (typeof REQUIRED_KEYS)[number];

const URL_KEYS = ['FOREST_SERVER_URL', 'FOREST_APP_URL', 'AGENT_URL'] as const;

export type PresenceMap = Record<RequiredKey, boolean>;

export interface BFFConfig {
  forestAuthSecret?: string;
  forestEnvSecret?: string;
  forestServerUrl?: string;
  forestAppUrl?: string;
  agentUrl?: string;
  httpPort: number;
  presence: PresenceMap;
  hasAllRequired: boolean;
}

const DECIMAL_INTEGER = /^\d+$/;
const MAX_PORT = 65535;
const HTTP_URL_SCHEMA = z.url({ protocol: /^https?$/ });

function normalize(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  return trimmed === '' ? undefined : trimmed;
}

function parsePort(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_BFF_PORT;

  const port = DECIMAL_INTEGER.test(raw) ? Number(raw) : NaN;

  if (Number.isNaN(port) || port > MAX_PORT) {
    throw new ConfigurationError(
      `Invalid configuration: HTTP_PORT must be an integer between 0 and ${MAX_PORT}.`,
    );
  }

  return port;
}

function isHttpUrl(value: string): boolean {
  return HTTP_URL_SCHEMA.safeParse(value).success;
}

export function parseConfig(env: NodeJS.ProcessEnv): BFFConfig {
  const normalized = Object.fromEntries(
    REQUIRED_KEYS.map(key => [key, normalize(env[key])]),
  ) as Record<RequiredKey, string | undefined>;

  for (const key of URL_KEYS) {
    const value = normalized[key];

    if (value !== undefined && !isHttpUrl(value)) {
      throw new ConfigurationError(`Invalid configuration: ${key} must be a valid http(s) URL.`);
    }
  }

  const presence = Object.fromEntries(
    REQUIRED_KEYS.map(key => [key, normalized[key] !== undefined]),
  ) as PresenceMap;

  return {
    forestAuthSecret: normalized.FOREST_AUTH_SECRET,
    forestEnvSecret: normalized.FOREST_ENV_SECRET,
    forestServerUrl: normalized.FOREST_SERVER_URL,
    forestAppUrl: normalized.FOREST_APP_URL,
    agentUrl: normalized.AGENT_URL,
    httpPort: parsePort(normalize(env.HTTP_PORT)),
    presence,
    hasAllRequired: REQUIRED_KEYS.every(key => presence[key]),
  };
}
