import type { Resolution } from './env-aliases';
import type { ConfigKey, ConfigLabels } from '@forestadmin/agent-bff';
import type { McpEnv, McpEnvLabels } from '@forestadmin/mcp-server';

import { CONFIG_KEYS, ConfigurationError, parsePublicUrl } from '@forestadmin/agent-bff';
import { normalizeDomainList, parseDomainList } from '@forestadmin/forestadmin-client';
import { MCP_LISTENER_ENV, normalizeMountPath } from '@forestadmin/mcp-server';

import EnvAliases from './env-aliases';

export type Service = 'mcp' | 'api';

export const SERVICES: readonly Service[] = ['mcp', 'api'];

export const SERVICES_VAR = 'FOREST_GATEWAY_SERVICES';
export const BASE_PATH_VAR = 'FOREST_GATEWAY_BASE_PATH';
export const PUBLIC_URL_VAR = 'FOREST_GATEWAY_URL';
export const PORT_VAR = 'PORT';
export const AGENT_URL_VAR = 'FOREST_AGENT_URL';
export const API_PUBLIC_URL_VAR = 'FOREST_GATEWAY_API_PUBLIC_URL';
export const ALLOWED_OAUTH_CLIENTS_VAR = 'FOREST_GATEWAY_ALLOWED_OAUTH_CLIENTS';

const API_VAR_PREFIX = 'FOREST_GATEWAY_API_';
const BFF_VAR_PREFIX = 'BFF_';

const BFF_LISTENER_ENV = {
  port: 'HTTP_PORT',
  publicUrl: 'BFF_PUBLIC_URL',
} as const satisfies Record<string, ConfigKey>;

const PORT_ALIASES = [MCP_LISTENER_ENV.port, BFF_LISTENER_ENV.port];
const PUBLIC_URL_ALIASES = [MCP_LISTENER_ENV.publicUrl];
const AGENT_URL_ALIASES = ['AGENT_URL'];
const ALLOWED_OAUTH_CLIENTS_ALIASES = ['FOREST_MCP_ALLOWED_OAUTH_CLIENTS'];

const MCP_LABELS: Partial<McpEnvLabels> = {
  accessTokenTtl: 'FOREST_MCP_ACCESS_TOKEN_TTL_SECONDS',
  refreshTokenTtl: 'FOREST_MCP_REFRESH_TOKEN_TTL_SECONDS',
};

export const DEFAULT_MCP_PORT = 3931;
export const DEFAULT_API_PORT = 3450;

const MAX_PORT = 65535;
const DECIMAL_INTEGER = /^\d+$/;
const HTTP_PROTOCOLS = ['http:', 'https:'];

export interface McpSettings {
  env: McpEnv;
  labels: Partial<McpEnvLabels>;
}

export interface ApiSettings {
  env: NodeJS.ProcessEnv;
  labels: ConfigLabels;
  allowedOAuthClients?: string[];
}

export interface GatewayEnv {
  services: Set<Service>;
  basePath: string;
  port: number;
  publicUrl?: string;
  mcp?: McpSettings;
  api?: ApiSettings;
  warnings: string[];
}

export interface OpenApiEnv {
  basePath: string;
  api: ApiSettings;
  warnings: string[];
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

export function apiBasePath(basePath: string): string {
  return `${basePath}/api`;
}

function parsePort({ key, value }: Resolution, fallback: number): number {
  const trimmed = value?.trim();

  if (!trimmed) return fallback;

  const port = DECIMAL_INTEGER.test(trimmed) ? Number(trimmed) : NaN;

  if (Number.isNaN(port) || port > MAX_PORT) {
    throw new ConfigurationError(
      `Invalid ${key} "${value}": expected an integer between 0 and ${MAX_PORT}.`,
    );
  }

  return port;
}

function parseGatewayUrl({ key, value }: Resolution): string | undefined {
  const trimmed = value?.trim();

  if (!trimmed) return undefined;

  const parsed = URL.canParse(trimmed) ? new URL(trimmed) : undefined;
  const isBareHttpOrigin =
    parsed && HTTP_PROTOCOLS.includes(parsed.protocol) && parsed.href === `${parsed.origin}/`;

  if (!isBareHttpOrigin) {
    throw new ConfigurationError(
      `Invalid ${key}: expected an http(s) origin with no path, query, fragment or ` +
        'credentials, e.g. https://gateway.example.com',
    );
  }

  return parsed.origin;
}

function assertAgentUrl({ key, value }: Resolution): void {
  if (value === undefined) return;

  const parsed = !/\s/.test(value) && URL.canParse(value) ? new URL(value) : undefined;

  if (!parsed || !HTTP_PROTOCOLS.includes(parsed.protocol) || parsed.search || parsed.hash) {
    throw new ConfigurationError(
      `Invalid ${key}: expected an absolute http(s) URL with no query string or fragment.`,
    );
  }
}

function parseAllowedOAuthClients({ key, value }: Resolution): string[] | undefined {
  if (value === undefined) return undefined;

  return normalizeDomainList(parseDomainList(value) ?? [], key);
}

function assertApiPublicUrl(value: string | undefined, key: string, basePath: string): void {
  const url = parsePublicUrl(value, key);
  const suffix = apiBasePath(basePath);

  if (url !== undefined && !new URL(url).pathname.endsWith(suffix)) {
    throw new ConfigurationError(
      `Invalid configuration: ${key} must end with ${suffix}, where the Gateway serves the API.`,
    );
  }
}

function resolveApi(
  env: NodeJS.ProcessEnv,
  aliases: EnvAliases,
  basePath: string,
  agentUrl: Resolution,
): ApiSettings {
  const apiEnv: NodeJS.ProcessEnv = {
    ...env,
    AGENT_URL: agentUrl.value,
    [BFF_LISTENER_ENV.port]: undefined,
  };
  const labels: ConfigLabels = { AGENT_URL: agentUrl.key };
  const bffKeys = CONFIG_KEYS.filter((key: ConfigKey) => key.startsWith(BFF_VAR_PREFIX));

  for (const bffKey of bffKeys) {
    const { key, value } = aliases.resolve(
      `${API_VAR_PREFIX}${bffKey.slice(BFF_VAR_PREFIX.length)}`,
      [bffKey],
    );

    apiEnv[bffKey] = value;
    labels[bffKey] = key;
  }

  assertApiPublicUrl(apiEnv.BFF_PUBLIC_URL, labels.BFF_PUBLIC_URL ?? API_PUBLIC_URL_VAR, basePath);

  return { env: apiEnv, labels };
}

function resolveAgentUrl(aliases: EnvAliases, withApi: boolean): Resolution {
  if (!withApi) {
    aliases.ignore(AGENT_URL_ALIASES, `the api service is off: use ${AGENT_URL_VAR}`);
  }

  const agentUrl = aliases.resolve(AGENT_URL_VAR, withApi ? AGENT_URL_ALIASES : []);
  assertAgentUrl(agentUrl);

  return agentUrl;
}

export function parseOpenApiEnv(env: NodeJS.ProcessEnv): OpenApiEnv {
  const basePath = normalizeMountPath(env[BASE_PATH_VAR], BASE_PATH_VAR);
  const aliases = new EnvAliases(env);
  const api = resolveApi(env, aliases, basePath, resolveAgentUrl(aliases, true));

  return { basePath, api, warnings: aliases.warnings };
}

export default function parseGatewayEnv(env: NodeJS.ProcessEnv): GatewayEnv {
  const services = parseServices(env[SERVICES_VAR]);
  const withMcp = services.has('mcp');
  const withApi = services.has('api');
  const basePath = normalizeMountPath(env[BASE_PATH_VAR], BASE_PATH_VAR);
  const aliases = new EnvAliases(env);
  const port = parsePort(
    aliases.resolve(PORT_VAR, PORT_ALIASES),
    withMcp ? DEFAULT_MCP_PORT : DEFAULT_API_PORT,
  );

  if (!withMcp) {
    aliases.ignore(
      [PUBLIC_URL_VAR, ...PUBLIC_URL_ALIASES],
      `the mcp service is off: the API reads ${API_PUBLIC_URL_VAR}`,
    );
  }

  const publicUrl = withMcp
    ? parseGatewayUrl(aliases.resolve(PUBLIC_URL_VAR, PUBLIC_URL_ALIASES))
    : undefined;
  const agentUrl = resolveAgentUrl(aliases, withApi);
  const allowedOAuthClients = aliases.resolve(
    ALLOWED_OAUTH_CLIENTS_VAR,
    ALLOWED_OAUTH_CLIENTS_ALIASES,
    { blankIsSet: true },
  );
  const allowedClientDomains = parseAllowedOAuthClients(allowedOAuthClients);

  if (withMcp && port === 0 && !publicUrl) {
    throw new ConfigurationError(
      `${PORT_VAR}=0 binds a port chosen by the OS, which cannot be in the url advertised to MCP ` +
        `clients. Set ${PUBLIC_URL_VAR} to the public url they should use.`,
    );
  }

  if (withMcp && !publicUrl) {
    aliases.warnings.push(
      `${PUBLIC_URL_VAR} is not set: MCP clients are told http://localhost:${port}`,
    );
  }

  const mcp: McpSettings | undefined = withMcp
    ? {
        env: {
          ...env,
          FOREST_AGENT_URL: agentUrl.value,
          FOREST_MCP_ALLOWED_OAUTH_CLIENTS: allowedOAuthClients.value,
          [MCP_LISTENER_ENV.port]: undefined,
          [MCP_LISTENER_ENV.publicUrl]: undefined,
        },
        labels: { ...MCP_LABELS, agentUrl: agentUrl.key },
      }
    : undefined;
  const api: ApiSettings | undefined = withApi
    ? {
        ...resolveApi(env, aliases, basePath, agentUrl),
        allowedOAuthClients: allowedClientDomains,
      }
    : undefined;

  return { services, basePath, port, publicUrl, mcp, api, warnings: aliases.warnings };
}
