import type { BFFConfig } from './config/env-config';
import type { Logger } from './ports/logger-port';
import type { Middleware } from 'koa';

import { bodyParser } from '@koa/bodyparser';

import createActionRoutesMiddleware from './action/action-routes-middleware';
import createConsoleLogger from './adapters/console-logger';
import createAgentStubMiddleware from './agent/agent-stub';
import createApiKeyAuthenticator from './api-key/api-key-authenticator';
import ApiKeyClient from './api-key/api-key-client';
import createApiKeyMiddleware from './api-key/api-key-middleware';
import createResolveCache from './api-key/resolve-cache';
import createAuthModeMiddleware from './auth/auth-mode-middleware';
import { parseConfig } from './config/env-config';
import createCorsMiddleware from './cors/cors-middleware';
import createPerKeyOriginMiddleware from './cors/per-key-origin';
import createDataRoutesMiddleware from './data/data-routes-middleware';
import { extractErrorMessage } from './errors';
import { unauthorized } from './http/bff-http-error';
import BFFHttpServer from './http/bff-http-server';
import BODY_LIMIT from './http/body-limit';
import createErrorMiddleware from './http/error-middleware';
import ForestServerClient from './oauth/forest-server-client';
import createOAuthRoutes from './oauth/oauth-routes';
import createInMemorySessionStore from './oauth/session-store';
import createTokenCipher from './oauth/token-cipher';
import createOpenApiRoutes from './openapi/openapi-routes';
import PermissionsCache from './permissions/permissions-cache';
import PermissionsClient from './permissions/permissions-client';
import createPermissionsRoutesMiddleware from './permissions/permissions-routes-middleware';
import createReadModel from './read-model/create-read-model';
import createTimezoneMiddleware from './timezone/timezone-middleware';
import version from './version';

const SESSION_TTL_SECONDS = 24 * 60 * 60;

function isAgentPath(path: string): boolean {
  return path === '/agent' || path.startsWith('/agent/');
}

function agentScoped(middleware: Middleware): Middleware {
  return async function scoped(ctx, next) {
    if (!isAgentPath(ctx.path)) {
      await next();

      return;
    }

    await middleware(ctx, next);
  };
}

function createApiKeyUnavailableGuard(logger: Logger): Middleware {
  return async function apiKeyUnavailableGuard(ctx, next) {
    if (ctx.state.authMode === 'api-key') {
      logger('Error', 'API key auth requested but the resolver is not configured');
      throw unauthorized('Credentials could not be validated');
    }

    await next();
  };
}

interface ResolvedOAuthConfig {
  forestServerUrl: string;
  forestEnvSecret: string;
  forestAppUrl: string;
  forestAuthSecret: string;
  tokenEncryptionKey: string;
}

function resolveOAuthConfig(config: BFFConfig): ResolvedOAuthConfig | undefined {
  const { forestServerUrl, forestEnvSecret, forestAppUrl, forestAuthSecret, tokenEncryptionKey } =
    config;

  if (
    forestServerUrl &&
    forestEnvSecret &&
    forestAppUrl &&
    forestAuthSecret &&
    tokenEncryptionKey
  ) {
    return { forestServerUrl, forestEnvSecret, forestAppUrl, forestAuthSecret, tokenEncryptionKey };
  }

  return undefined;
}

async function buildOAuthMiddlewares(config: BFFConfig, logger: Logger): Promise<Middleware[]> {
  const oauthConfig = resolveOAuthConfig(config);

  if (!oauthConfig) {
    logger('Warn', 'OAuth routes disabled: required configuration is missing');

    return [];
  }

  const { forestServerUrl, forestEnvSecret, forestAppUrl, forestAuthSecret, tokenEncryptionKey } =
    oauthConfig;

  const serverClient = new ForestServerClient({ forestServerUrl, envSecret: forestEnvSecret });
  const environmentId = await serverClient.fetchEnvironmentId();

  const sessionStore = createInMemorySessionStore({
    cipher: createTokenCipher(tokenEncryptionKey),
    now: () => Date.now(),
    sessionTtlSeconds: SESSION_TTL_SECONDS,
  });

  const oauthRoutes = createOAuthRoutes({
    serverClient,
    sessionStore,
    forestAppUrl,
    authSecret: forestAuthSecret,
    environmentId,
    logger,
  });

  return [oauthRoutes];
}

interface ResolvedApiKeyConfig {
  forestServerUrl: string;
  forestEnvSecret: string;
  forestAuthSecret: string;
}

function resolveApiKeyConfig(config: BFFConfig): ResolvedApiKeyConfig | undefined {
  const { forestServerUrl, forestEnvSecret, forestAuthSecret } = config;

  if (forestServerUrl && forestEnvSecret && forestAuthSecret) {
    return { forestServerUrl, forestEnvSecret, forestAuthSecret };
  }

  return undefined;
}

function buildApiKeyMiddleware(config: BFFConfig, logger: Logger): Middleware | undefined {
  const apiKeyConfig = resolveApiKeyConfig(config);

  if (!apiKeyConfig) {
    logger('Warn', 'API key auth disabled: required configuration is missing');

    return undefined;
  }

  const client = new ApiKeyClient({
    forestServerUrl: apiKeyConfig.forestServerUrl,
    envSecret: apiKeyConfig.forestEnvSecret,
  });
  const cache = createResolveCache({ now: () => Date.now() });
  const authenticator = createApiKeyAuthenticator({
    client,
    cache,
    authSecret: apiKeyConfig.forestAuthSecret,
  });

  return createApiKeyMiddleware({ authenticator, logger });
}

// Data and action routes share one read-model store (a single cache, a single schema fetch). The
// data middleware falls through to the action middleware on a non-data path.
function buildAgentRouteMiddlewares(config: BFFConfig, logger: Logger): Middleware[] {
  const apiKeyConfig = resolveApiKeyConfig(config);

  if (!apiKeyConfig || !config.agentUrl) {
    logger('Warn', 'Data endpoints disabled: AGENT_URL or read-model configuration is missing');

    return [createAgentStubMiddleware()];
  }

  const { store } = createReadModel({
    forestServerUrl: apiKeyConfig.forestServerUrl,
    envSecret: apiKeyConfig.forestEnvSecret,
    logger,
  });
  const { agentUrl, agentTimeoutMs: timeoutMs } = config;
  const permissionsCache = new PermissionsCache();
  store.registerGenerationScopedCache(permissionsCache);

  return [
    createPermissionsRoutesMiddleware({
      store,
      client: new PermissionsClient({
        forestServerUrl: apiKeyConfig.forestServerUrl,
        envSecret: apiKeyConfig.forestEnvSecret,
      }),
      cache: permissionsCache,
      envSecret: apiKeyConfig.forestEnvSecret,
      logger,
    }),
    createDataRoutesMiddleware({ store, agentUrl, timeoutMs, logger }),
    createActionRoutesMiddleware({ store, agentUrl, timeoutMs, logger }),
  ];
}

function buildAgentMiddlewares(config: BFFConfig, logger: Logger): Middleware[] {
  const { forestAuthSecret, defaultTimezone } = config;

  if (!forestAuthSecret) {
    logger('Warn', 'Agent edge disabled: FOREST_AUTH_SECRET is missing');

    return [];
  }

  const apiKeyStep = buildApiKeyMiddleware(config, logger) ?? createApiKeyUnavailableGuard(logger);

  const chain: Middleware[] = [
    createAuthModeMiddleware({ authSecret: forestAuthSecret }),
    apiKeyStep,
    createPerKeyOriginMiddleware(),
    createOpenApiRoutes({ version, enabled: config.openapiEnabled }),
    createTimezoneMiddleware({ defaultTimezone }),
    ...buildAgentRouteMiddlewares(config, logger),
  ];

  return chain.map(agentScoped);
}

export default async function runCli(
  env: NodeJS.ProcessEnv,
  logger: Logger = createConsoleLogger(),
): Promise<BFFHttpServer> {
  const config = parseConfig(env);

  if (config.invalidAllowedOrigins.length > 0) {
    logger('Warn', 'Ignoring malformed BFF_ALLOWED_ORIGINS entries', {
      entries: config.invalidAllowedOrigins,
    });
  }

  const oauthMiddlewares = await buildOAuthMiddlewares(config, logger);
  const agentMiddlewares = buildAgentMiddlewares(config, logger);
  const agentErrorMiddleware =
    agentMiddlewares.length > 0 ? [agentScoped(createErrorMiddleware({ logger }))] : [];
  const middlewares = [
    createCorsMiddleware({ allowedOrigins: config.allowedOrigins }),
    ...agentErrorMiddleware,
    bodyParser({ jsonLimit: BODY_LIMIT }),
    ...oauthMiddlewares,
    ...agentMiddlewares,
  ];
  const server = new BFFHttpServer({
    port: config.httpPort,
    version,
    config,
    logger,
    middlewares,
  });

  await server.start();

  return server;
}

export function reportFatalError(err: unknown): void {
  process.stderr.write(`Error: ${extractErrorMessage(err)}\n`);
  process.exitCode = 1;
}
