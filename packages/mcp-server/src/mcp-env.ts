import type { ForestMCPServerOptions } from './server';

import normalizeAgentUrl from './utils/normalize-agent-url';
import parseDomainList from './utils/parse-domain-list';
import parseToolList from './utils/parse-tool-list';
import { assertTokenSeconds } from './utils/token-ttl';

export type McpEnv = Record<string, string | undefined>;

export type McpEnvLabels = {
  accessTokenTtl: string;
  refreshTokenTtl: string;
  fileUploads: string;
  uploadStorageModule: string;
  agentUrl: string;
  port: string;
  publicUrl: string;
};

export type McpListenerSettings = {
  port?: number;
  publicUrl?: string;
};

export type ParsedMcpEnv = {
  options: Pick<
    ForestMCPServerOptions,
    | 'forestServerUrl'
    | 'forestAppUrl'
    | 'envSecret'
    | 'authSecret'
    | 'enabledTools'
    | 'allowedOAuthClients'
    | 'agentUrl'
    | 'tokenTtl'
  > & { fileUploads?: false };
  listener: McpListenerSettings;
  uploadStorageModule?: string;
};

export const DEFAULT_MCP_ENV_LABELS: McpEnvLabels = {
  accessTokenTtl: 'tokenTtl.accessTokenSeconds',
  refreshTokenTtl: 'tokenTtl.refreshTokenSeconds',
  fileUploads: 'FOREST_MCP_FILE_UPLOADS',
  uploadStorageModule: 'FOREST_MCP_UPLOAD_STORAGE_MODULE',
  agentUrl: 'agentUrl',
  port: 'MCP_SERVER_PORT',
  publicUrl: 'FOREST_MCP_SERVER_URL',
};

const MAX_PORT = 65535;
const FILE_UPLOADS_FLAGS = ['true', 'false'];
const HTTP_PROTOCOLS = ['http:', 'https:'];

function parseSeconds(value: string | undefined, label: string): number | undefined {
  const seconds = value === undefined ? undefined : Number(value);
  assertTokenSeconds(label, seconds);

  return seconds;
}

function parsePort(rawPort: string | undefined, label: string): number | undefined {
  if (!rawPort) return undefined;

  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 0 || port > MAX_PORT) {
    throw new Error(
      `Invalid ${label} "${rawPort}": expected an integer between 0 and ${MAX_PORT}.`,
    );
  }

  return port;
}

function showWithoutCredentials(rawUrl: string, parsed?: URL): string {
  return parsed && parsed.origin !== 'null'
    ? parsed.origin
    : rawUrl.slice(rawUrl.lastIndexOf('@') + 1);
}

function parsePublicUrl(configuredUrl: string | undefined, label: string): string | undefined {
  if (!configuredUrl) return undefined;

  const parsed = URL.canParse(configuredUrl) ? new URL(configuredUrl) : undefined;
  const isBareHttpOrigin =
    parsed && HTTP_PROTOCOLS.includes(parsed.protocol) && parsed.href === `${parsed.origin}/`;

  if (!isBareHttpOrigin) {
    throw new Error(
      `Invalid ${label} "${showWithoutCredentials(configuredUrl, parsed)}": expected an http(s) ` +
        'origin with no path, query, fragment or credentials, e.g. https://mcp.example.com',
    );
  }

  return configuredUrl;
}

function parseFileUploadsOff(rawFlag: string | undefined, label: string): boolean {
  if (rawFlag !== undefined && !FILE_UPLOADS_FLAGS.includes(rawFlag)) {
    throw new Error(
      `Invalid ${label} "${rawFlag}": use 'false' to turn action file uploads off. ` +
        'They are on by default.',
    );
  }

  return rawFlag === 'false';
}

export function parseMcpListenerEnv(
  env: McpEnv,
  labels: Partial<McpEnvLabels> = {},
): McpListenerSettings {
  const { port, publicUrl } = { ...DEFAULT_MCP_ENV_LABELS, ...labels };

  return {
    port: parsePort(env.MCP_SERVER_PORT, port),
    publicUrl: parsePublicUrl(env.FOREST_MCP_SERVER_URL, publicUrl),
  };
}

export default function parseMcpEnv(env: McpEnv, labels: Partial<McpEnvLabels> = {}): ParsedMcpEnv {
  const label = { ...DEFAULT_MCP_ENV_LABELS, ...labels };
  const fileUploadsOff = parseFileUploadsOff(env.FOREST_MCP_FILE_UPLOADS, label.fileUploads);

  normalizeAgentUrl(env.FOREST_AGENT_URL, label.agentUrl);

  return {
    options: {
      forestServerUrl: env.FOREST_SERVER_URL || 'https://api.forestadmin.com',
      forestAppUrl: env.FOREST_APP_URL || 'https://app.forestadmin.com',
      envSecret: env.FOREST_ENV_SECRET,
      authSecret: env.FOREST_AUTH_SECRET,
      enabledTools: parseToolList(env.FOREST_MCP_ENABLED_TOOLS),
      allowedOAuthClients: parseDomainList(env.FOREST_MCP_ALLOWED_OAUTH_CLIENTS),
      agentUrl: env.FOREST_AGENT_URL,
      tokenTtl: {
        accessTokenSeconds: parseSeconds(
          env.FOREST_MCP_ACCESS_TOKEN_TTL_SECONDS,
          label.accessTokenTtl,
        ),
        refreshTokenSeconds: parseSeconds(
          env.FOREST_MCP_REFRESH_TOKEN_TTL_SECONDS,
          label.refreshTokenTtl,
        ),
      },
      ...(fileUploadsOff && { fileUploads: false as const }),
    },
    listener: parseMcpListenerEnv(env, label),
    uploadStorageModule: fileUploadsOff ? undefined : env.FOREST_MCP_UPLOAD_STORAGE_MODULE,
  };
}
