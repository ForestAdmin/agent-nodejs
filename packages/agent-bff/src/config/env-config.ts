import { z } from 'zod';

import { parseAllowedOrigins } from '../cors/origin';
import DEFAULT_BFF_PORT from '../defaults';
import { ConfigurationError } from '../errors';
import { isValidTimezone } from '../timezone/timezone';

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
  tokenEncryptionKey?: string;
  allowedOrigins: string[];
  invalidAllowedOrigins: string[];
  defaultTimezone?: string;
  httpPort: number;
  presence: PresenceMap;
  hasAllRequired: boolean;
}

const DECIMAL_INTEGER = /^\d+$/;
const MAX_PORT = 65535;
const ENCRYPTION_KEY_BYTES = 32;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
const HTTP_URL_SCHEMA = z.url({ protocol: /^https?$/ });

function normalize(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === '' ? undefined : value;
}

function parsePort(raw: string | undefined): number {
  const trimmed = raw?.trim();
  if (trimmed === undefined || trimmed === '') return DEFAULT_BFF_PORT;

  const port = DECIMAL_INTEGER.test(trimmed) ? Number(trimmed) : NaN;

  if (Number.isNaN(port) || port > MAX_PORT) {
    throw new ConfigurationError(
      `Invalid configuration: HTTP_PORT must be an integer between 0 and ${MAX_PORT}.`,
    );
  }

  return port;
}

function isHttpUrl(value: string): boolean {
  return !/\s/.test(value) && HTTP_URL_SCHEMA.safeParse(value).success;
}

function isValidEncryptionKey(value: string): boolean {
  return BASE64_PATTERN.test(value) && Buffer.from(value, 'base64').length === ENCRYPTION_KEY_BYTES;
}

function parseEncryptionKey(raw: string | undefined): string | undefined {
  const value = normalize(raw);

  if (value !== undefined && !isValidEncryptionKey(value)) {
    throw new ConfigurationError(
      `Invalid configuration: BFF_TOKEN_ENCRYPTION_KEY must be base64-encoded and exactly ${ENCRYPTION_KEY_BYTES} bytes (AES-256).`,
    );
  }

  return value;
}

function parseDefaultTimezone(raw: string | undefined): string | undefined {
  const value = normalize(raw);

  if (value !== undefined && !isValidTimezone(value)) {
    throw new ConfigurationError(
      `Invalid configuration: BFF_DEFAULT_TIMEZONE must be a valid IANA timezone.`,
    );
  }

  return value;
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

  const tokenEncryptionKey = parseEncryptionKey(env.BFF_TOKEN_ENCRYPTION_KEY);
  const { origins: allowedOrigins, invalid: invalidAllowedOrigins } = parseAllowedOrigins(
    env.BFF_ALLOWED_ORIGINS,
  );
  const defaultTimezone = parseDefaultTimezone(env.BFF_DEFAULT_TIMEZONE);

  return {
    forestAuthSecret: normalized.FOREST_AUTH_SECRET,
    forestEnvSecret: normalized.FOREST_ENV_SECRET,
    forestServerUrl: normalized.FOREST_SERVER_URL,
    forestAppUrl: normalized.FOREST_APP_URL,
    agentUrl: normalized.AGENT_URL,
    tokenEncryptionKey,
    allowedOrigins,
    invalidAllowedOrigins,
    defaultTimezone,
    httpPort: parsePort(env.HTTP_PORT),
    presence,
    hasAllRequired: REQUIRED_KEYS.every(key => presence[key]) && tokenEncryptionKey !== undefined,
  };
}
