import type { GatewayEnv } from './gateway-env';
import type { ApiHealth, McpHealth } from './standalone-handler';
import type { Bff, Logger } from '@forestadmin/agent-bff';
import type { GatewayHandler } from '@forestadmin/mcp-server';

import {
  BFFHttpServer,
  buildBff,
  claimsBffPath,
  createConsoleLogger,
  installShutdownHandlers,
  parseConfig,
} from '@forestadmin/agent-bff';
import {
  ForestMCPServer,
  createGatewaySwitch,
  loadFileUploads,
  makeIsMcpRoute,
  parseMcpEnv,
} from '@forestadmin/mcp-server';

import parseGatewayEnv, { apiBasePath, toBffEnv, toMcpEnv, warnLegacyVars } from './gateway-env';
import createStandaloneHandler, {
  createUnavailableMcpHandler,
  describeGatewayHealth,
} from './standalone-handler';
import version from './version';

export const GATEWAY_NAME = 'Forest Gateway';

const MCP_REQUIRED_VARS = ['FOREST_ENV_SECRET', 'FOREST_AUTH_SECRET'] as const;

interface McpService {
  handler: GatewayHandler;
  health: McpHealth;
}

interface ApiService {
  handler: GatewayHandler;
  bff: Bff;
}

function missingMcpVars(env: NodeJS.ProcessEnv): string[] {
  return MCP_REQUIRED_VARS.filter(name => !env[name]?.trim());
}

async function buildMcpService(
  env: NodeJS.ProcessEnv,
  gateway: GatewayEnv,
  logger: Logger,
): Promise<McpService> {
  const missing = missingMcpVars(env);

  if (missing.length > 0) {
    logger('Error', 'The MCP service is not configured and answers 503 until restart', {
      missing,
    });

    return { handler: createUnavailableMcpHandler(gateway.basePath), health: 'degraded' };
  }

  const { options, uploadStorageModule } = parseMcpEnv(toMcpEnv(env));
  const fileUploads = await loadFileUploads(uploadStorageModule);
  const server = new ForestMCPServer({
    ...options,
    ...(fileUploads !== undefined && { fileUploads }),
    basePath: gateway.basePath,
    logger: (level, message) => logger(level, `[MCP] ${message}`),
  });
  const baseUrl = new URL(gateway.publicUrl ?? `http://localhost:${gateway.port}`);

  return {
    handler: {
      matches: makeIsMcpRoute(gateway.basePath),
      callback: await server.getHttpCallback(baseUrl),
    },
    health: 'ok',
  };
}

async function buildApiService(
  env: NodeJS.ProcessEnv,
  gateway: GatewayEnv,
  logger: Logger,
): Promise<ApiService> {
  const config = parseConfig(toBffEnv(env, gateway));
  const bff = await buildBff({
    config,
    logger,
    basePath: apiBasePath(gateway.basePath),
    gatewayVersion: version,
  });

  return {
    handler: {
      matches: pathname => claimsBffPath(pathname, { docs: config.openapiEnabled }),
      callback: bff.callback,
    },
    bff,
  };
}

function apiHealthOf(api: ApiService | undefined): ApiHealth {
  if (!api) return 'disabled';

  const { status, configured } = api.bff.health();

  return { status, configured };
}

function logRoutes(
  gateway: GatewayEnv,
  mcp: McpService | undefined,
  api: ApiService | undefined,
  logger: Logger,
): void {
  const prefix = gateway.basePath;

  if (mcp) {
    logger('Info', `MCP service on ${prefix}/mcp`, {
      oauth: `${prefix}/oauth/*`,
      discovery: `/.well-known/oauth-authorization-server${prefix}`,
      status: mcp.health,
    });
  }

  if (api) {
    const apiPrefix = apiBasePath(prefix);

    logger('Info', `API service on ${apiPrefix}/agent/*`, {
      health: `${apiPrefix}/health`,
      docs: `${apiPrefix}/docs`,
      oauth: api.bff.health().configured.oauth ? `${prefix}/oauth/*?service=api` : 'API OAuth off',
    });
  }

  logger('Info', 'Gateway health on /health');
}

export default async function runGateway(
  env: NodeJS.ProcessEnv,
  logger: Logger = createConsoleLogger(),
): Promise<BFFHttpServer> {
  const gateway = parseGatewayEnv(env);

  warnLegacyVars(env, logger);

  const mcp = gateway.services.has('mcp') ? await buildMcpService(env, gateway, logger) : undefined;
  const api = gateway.services.has('api') ? await buildApiService(env, gateway, logger) : undefined;

  const gatewaySwitch = createGatewaySwitch({
    basePath: gateway.basePath,
    mcp: mcp?.handler,
    api: api?.handler,
  });

  const callback = createStandaloneHandler({
    version,
    gatewaySwitch,
    health: () => describeGatewayHealth(version, mcp?.health ?? 'disabled', apiHealthOf(api)),
  });

  const server = new BFFHttpServer({
    port: gateway.port,
    logger,
    name: GATEWAY_NAME,
    callback,
    drainActivityLogs: api?.bff.drainActivityLogs,
  });

  await server.start();
  installShutdownHandlers(server, logger, { name: GATEWAY_NAME });
  logRoutes(gateway, mcp, api, logger);

  return server;
}
