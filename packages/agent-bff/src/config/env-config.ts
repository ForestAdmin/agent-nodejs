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
  publicUrl?: string;
  tokenEncryptionKey?: string;
  allowedOrigins: string[];
  invalidAllowedOrigins: string[];
  defaultTimezone?: string;
  agentTimeoutMs?: number;
  aiTimeoutMs: number;
  openapiEnabled: boolean;
  rateLimitMaxRequests: number;
  rateLimitWindowMs: number;
  httpPort: number;
  presence: PresenceMap;
  hasAllRequired: boolean;
}

const DECIMAL_INTEGER = /^\d+$/;
export const DEFAULT_AGENT_TIMEOUT_MS = 10_000;
export const DEFAULT_AI_TIMEOUT_MS = 120_000;
export const MAX_TIMEOUT_MS = 2_147_483_647;
export const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 300;
export const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
export const MAX_RATE_LIMIT_REQUESTS = 10_000;
export const MIN_RATE_LIMIT_WINDOW_MS = 1_000;
const MAX_PORT = 65535;
const ENCRYPTION_KEY_BYTES = 32;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
const HTTP_URL_SCHEMA = z.url({ protocol: /^https?$/ });

function normalize(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === '' ? undefined : value;
}

function parseBoundedInteger(
  raw: string | undefined,
  envName: string,
  { min, max, fallback }: { min: number; max: number; fallback: number },
): number {
  const value = normalize(raw);
  if (value === undefined) return fallback;

  const parsed = DECIMAL_INTEGER.test(value.trim()) ? Number(value.trim()) : NaN;

  if (Number.isNaN(parsed) || parsed < min || parsed > max) {
    throw new ConfigurationError(
      `Invalid configuration: ${envName} must be an integer between ${min} and ${max}.`,
    );
  }

  return parsed;
}

function parsePort(raw?: string): number {
  return parseBoundedInteger(raw, 'HTTP_PORT', {
    min: 0,
    max: MAX_PORT,
    fallback: DEFAULT_BFF_PORT,
  });
}

function isHttpUrl(value: string): boolean {
  return !/\s/.test(value) && HTTP_URL_SCHEMA.safeParse(value).success;
}

export function parsePublicUrl(raw?: string): string | undefined {
  const value = normalize(raw);

  if (value === undefined) return undefined;

  if (!isHttpUrl(value)) {
    throw new ConfigurationError(
      'Invalid configuration: BFF_PUBLIC_URL must be a valid http(s) URL.',
    );
  }

  if (value.includes('?') || value.includes('#')) {
    throw new ConfigurationError(
      'Invalid configuration: BFF_PUBLIC_URL must not carry a query string or fragment.',
    );
  }

  const url = new URL(value);

  if (url.username !== '' || url.password !== '') {
    throw new ConfigurationError(
      'Invalid configuration: BFF_PUBLIC_URL must not carry credentials.',
    );
  }

  return url.href.replace(/\/+$/, '');
}

function isValidEncryptionKey(value: string): boolean {
  return BASE64_PATTERN.test(value) && Buffer.from(value, 'base64').length === ENCRYPTION_KEY_BYTES;
}

function parseEncryptionKey(raw?: string): string | undefined {
  const value = normalize(raw);

  if (value !== undefined && !isValidEncryptionKey(value)) {
    throw new ConfigurationError(
      `Invalid configuration: BFF_TOKEN_ENCRYPTION_KEY must be base64-encoded and exactly ${ENCRYPTION_KEY_BYTES} bytes (AES-256).`,
    );
  }

  return value;
}

function parseTimeoutMs(raw: string | undefined, envName: string, defaultMs: number): number {
  return parseBoundedInteger(raw, envName, { min: 1, max: MAX_TIMEOUT_MS, fallback: defaultMs });
}

function parseDefaultTimezone(raw?: string): string | undefined {
  const value = normalize(raw);

  if (value !== undefined && !isValidTimezone(value)) {
    throw new ConfigurationError(
      `Invalid configuration: BFF_DEFAULT_TIMEZONE must be a valid IANA timezone.`,
    );
  }

  return value;
}

function parseOpenApiEnabled(raw?: string): boolean {
  const value = normalize(raw)?.trim().toLowerCase();
  if (value === undefined || value === 'true') return true;
  if (value === 'false') return false;

  throw new ConfigurationError(
    'Invalid configuration: BFF_OPENAPI_ENABLED must be a boolean (true/false).',
  );
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
    publicUrl: parsePublicUrl(env.BFF_PUBLIC_URL),
    tokenEncryptionKey,
    allowedOrigins,
    invalidAllowedOrigins,
    defaultTimezone,
    agentTimeoutMs: parseTimeoutMs(
      env.BFF_AGENT_TIMEOUT_MS,
      'BFF_AGENT_TIMEOUT_MS',
      DEFAULT_AGENT_TIMEOUT_MS,
    ),
    aiTimeoutMs: parseTimeoutMs(env.BFF_AI_TIMEOUT_MS, 'BFF_AI_TIMEOUT_MS', DEFAULT_AI_TIMEOUT_MS),
    openapiEnabled: parseOpenApiEnabled(env.BFF_OPENAPI_ENABLED),
    rateLimitMaxRequests: parseBoundedInteger(
      env.BFF_RATE_LIMIT_MAX_REQUESTS,
      'BFF_RATE_LIMIT_MAX_REQUESTS',
      {
        min: 1,
        max: MAX_RATE_LIMIT_REQUESTS,
        fallback: DEFAULT_RATE_LIMIT_MAX_REQUESTS,
      },
    ),
    rateLimitWindowMs: parseBoundedInteger(
      env.BFF_RATE_LIMIT_WINDOW_MS,
      'BFF_RATE_LIMIT_WINDOW_MS',
      {
        min: MIN_RATE_LIMIT_WINDOW_MS,
        max: MAX_TIMEOUT_MS,
        fallback: DEFAULT_RATE_LIMIT_WINDOW_MS,
      },
    ),
    httpPort: parsePort(env.HTTP_PORT),
    presence,
    hasAllRequired: REQUIRED_KEYS.every(key => presence[key]) && tokenEncryptionKey !== undefined,
  };
}
