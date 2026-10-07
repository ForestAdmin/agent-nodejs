import type { ConfigKey, Logger } from '@forestadmin/agent-bff';

import { ConfigurationError } from '@forestadmin/agent-bff';
import { MCP_LISTENER_ENV, normalizeMountPath } from '@forestadmin/mcp-server';

export type Service = 'mcp' | 'api';

export const SERVICES: readonly Service[] = ['mcp', 'api'];

export const SERVICES_VAR = 'FOREST_GATEWAY_SERVICES';
export const BASE_PATH_VAR = 'FOREST_GATEWAY_BASE_PATH';
export const PUBLIC_URL_VAR = 'FOREST_GATEWAY_URL';
export const PORT_VAR = 'PORT';

export const DEFAULT_MCP_PORT = 3931;
export const DEFAULT_API_PORT = 3450;

const MAX_PORT = 65535;
const DECIMAL_INTEGER = /^\d+$/;
const HTTP_PROTOCOLS = ['http:', 'https:'];

const BFF_LISTENER_ENV = {
  port: 'HTTP_PORT',
  publicUrl: 'BFF_PUBLIC_URL',
} as const satisfies Record<string, ConfigKey>;

const LEGACY_VARS: Record<string, string> = {
  [MCP_LISTENER_ENV.port]: PORT_VAR,
  [BFF_LISTENER_ENV.port]: PORT_VAR,
  [MCP_LISTENER_ENV.publicUrl]: PUBLIC_URL_VAR,
  [BFF_LISTENER_ENV.publicUrl]: PUBLIC_URL_VAR,
};

export interface GatewayUrls {
  basePath: string;
  publicUrl?: string;
}

export interface GatewayEnv extends GatewayUrls {
  services: Set<Service>;
  port: number;
}

function isService(value: string): value is Service {
  return (SERVICES as readonly string[]).includes(value);
}

export function parseServices(raw: string | undefined): Set<Service> {
  const entries = (raw ?? '')
    .split(',')
    .map(entry => entry.trim())
    .filter(entry => entry !== '');

  if (entries.length === 0 || !entries.every(isService)) {
    throw new ConfigurationError(
      `Invalid ${SERVICES_VAR} "${raw ?? ''}": list the services to serve, ` +
        `among ${SERVICES.map(service => `"${service}"`).join(', ')} (e.g. "mcp,api").`,
    );
  }

  return new Set(entries as Service[]);
}

function parsePort(raw: string | undefined, fallback: number): number {
  const value = raw?.trim();

  if (!value) return fallback;

  const port = DECIMAL_INTEGER.test(value) ? Number(value) : NaN;

  if (Number.isNaN(port) || port > MAX_PORT) {
    throw new ConfigurationError(
      `Invalid ${PORT_VAR} "${raw}": expected an integer between 0 and ${MAX_PORT}.`,
    );
  }

  return port;
}

function parsePublicUrl(raw: string | undefined): string | undefined {
  const value = raw?.trim();

  if (!value) return undefined;

  const parsed = URL.canParse(value) ? new URL(value) : undefined;
  const isBareHttpOrigin =
    parsed && HTTP_PROTOCOLS.includes(parsed.protocol) && parsed.href === `${parsed.origin}/`;

  if (!isBareHttpOrigin) {
    throw new ConfigurationError(
      `Invalid ${PUBLIC_URL_VAR}: expected an http(s) origin with no path, query, fragment or ` +
        'credentials, e.g. https://gateway.example.com',
    );
  }

  return parsed.origin;
}

export function warnLegacyVars(env: NodeJS.ProcessEnv, logger: Logger): void {
  for (const [legacy, replacement] of Object.entries(LEGACY_VARS)) {
    if (env[legacy]?.trim()) {
      logger('Warn', `${legacy} is ignored by forest-gateway: use ${replacement} instead`);
    }
  }
}

export function parseGatewayUrls(env: NodeJS.ProcessEnv): GatewayUrls {
  return {
    basePath: normalizeMountPath(env[BASE_PATH_VAR], BASE_PATH_VAR),
    publicUrl: parsePublicUrl(env[PUBLIC_URL_VAR]),
  };
}

export default function parseGatewayEnv(env: NodeJS.ProcessEnv): GatewayEnv {
  const services = parseServices(env[SERVICES_VAR]);
  const { basePath, publicUrl } = parseGatewayUrls(env);
  const port = parsePort(env[PORT_VAR], services.has('mcp') ? DEFAULT_MCP_PORT : DEFAULT_API_PORT);

  if (services.has('mcp') && port === 0 && !publicUrl) {
    throw new ConfigurationError(
      `${PORT_VAR}=0 binds a port chosen by the OS, which cannot be in the url advertised to MCP ` +
        `clients. Set ${PUBLIC_URL_VAR} to the public url they should use.`,
    );
  }

  return { services, basePath, port, publicUrl };
}

export function apiBasePath(basePath: string): string {
  return `${basePath}/api`;
}

export function toBffEnv(env: NodeJS.ProcessEnv, gateway: GatewayUrls): NodeJS.ProcessEnv {
  return {
    ...env,
    [BFF_LISTENER_ENV.port]: undefined,
    [BFF_LISTENER_ENV.publicUrl]:
      gateway.publicUrl && `${gateway.publicUrl}${apiBasePath(gateway.basePath)}`,
  };
}

export function toMcpEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return { ...env, [MCP_LISTENER_ENV.port]: undefined, [MCP_LISTENER_ENV.publicUrl]: undefined };
}
