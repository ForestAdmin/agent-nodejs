import type { BFFConfig } from './config/env-config';
import type { UnfoldSource } from './openapi/unfolded-document';
import type { Logger } from './ports/logger-port';
import type { Metrics } from './ports/metrics-port';
import type ReadModelStore from './read-model/read-model-store';
import type SchemaCache from './read-model/schema-cache';
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
import createDocsRoutes from './docs/docs-routes';
import { extractErrorMessage } from './errors';
import { unauthorized } from './http/bff-http-error';
import BFFHttpServer from './http/bff-http-server';
import BODY_LIMIT from './http/body-limit';
import createErrorMiddleware from './http/error-middleware';
import ForestServerClient from './oauth/forest-server-client';
import createOAuthRoutes from './oauth/oauth-routes';
import createInMemorySessionStore from './oauth/session-store';
import createTokenCipher from './oauth/token-cipher';
import createOpenApiRoutes, { OPENAPI_PATH } from './openapi/openapi-routes';
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

interface AgentEdgeReadModel {
  store: ReadModelStore;
  schemaCache: SchemaCache;
  apiKeyConfig: ResolvedApiKeyConfig;
}

/**
 * The read-model store the data routes, the action routes, the permissions endpoint and the OpenAPI
 * unfolding all share — one cache, one schema fetch. Needs no agent: the permissions endpoint and the
 * schema itself come from the SaaS.
 */
function resolveReadModelBundle(
  config: BFFConfig,
  logger: Logger,
  metrics?: Metrics,
): AgentEdgeReadModel | undefined {
  const apiKeyConfig = resolveApiKeyConfig(config);

  if (!apiKeyConfig) return undefined;

  const { store, schemaCache } = createReadModel({
    forestServerUrl: apiKeyConfig.forestServerUrl,
    envSecret: apiKeyConfig.forestEnvSecret,
    logger,
    metrics,
  });

  return { store, schemaCache, apiKeyConfig };
}

/**
 * When unfolding is possible, in ONE place: the document needs the AGENT_URL the store does not,
 * because a collection's field set comes from the agent capabilities. The server passes the bundle it
 * already built for the data routes; the CLI goes through `resolveUnfoldSource`. Silent on purpose —
 * the two report a missing configuration differently.
 */
function toUnfoldSource(
  bundle: AgentEdgeReadModel | undefined,
  config: BFFConfig,
  logger: Logger,
): UnfoldSource | undefined {
  if (!bundle || !config.agentUrl) return undefined;

  return {
    store: bundle.store,
    agentUrl: config.agentUrl,
    timeoutMs: config.agentTimeoutMs,
    logger,
  };
}

/**
 * Metrics are dropped rather than logged: without an explicit sink `createReadModel` builds a console
 * one, which reports gauges at `Info`, and `createConsoleLogger` sends `Info` to `console.info` — the
 * stdout the document is written to. The server keeps its metrics; the export has no sink for them
 * anyway.
 */
const UNMEASURED: Metrics = { increment: () => undefined, gauge: () => undefined };

export function resolveUnfoldSource(config: BFFConfig, logger: Logger): UnfoldSource | undefined {
  return toUnfoldSource(resolveReadModelBundle(config, logger, UNMEASURED), config, logger);
}

// The data middleware falls through to the action middleware on a non-data path.
function buildAgentRouteMiddlewares(
  bundle: AgentEdgeReadModel | undefined,
  config: BFFConfig,
  logger: Logger,
): Middleware[] {
  if (!bundle) {
    logger(
      'Warn',
      'Data, action and permissions endpoints disabled: FOREST_SERVER_URL, FOREST_ENV_SECRET or FOREST_AUTH_SECRET is missing',
    );

    return [createAgentStubMiddleware()];
  }

  const { store, apiKeyConfig } = bundle;
  const { agentUrl, agentTimeoutMs: timeoutMs } = config;

  const permissionsMiddleware = createPermissionsRoutesMiddleware({
    store,
    client: new PermissionsClient({
      forestServerUrl: apiKeyConfig.forestServerUrl,
      envSecret: apiKeyConfig.forestEnvSecret,
    }),
    cache: new PermissionsCache(),
    logger,
  });

  if (!agentUrl) {
    logger('Warn', 'Data and action endpoints disabled: AGENT_URL is missing');

    return [permissionsMiddleware, createAgentStubMiddleware()];
  }

  return [
    permissionsMiddleware,
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
  // One store for the whole edge. The document only unfolds when the agent is reachable too: with no
  // AGENT_URL every data path answers 501, so concrete paths would advertise a dead surface.
  const bundle = resolveReadModelBundle(config, logger);
  const source = toUnfoldSource(bundle, config, logger);

  const chain: Middleware[] = [
    createAuthModeMiddleware({ authSecret: forestAuthSecret }),
    apiKeyStep,
    createPerKeyOriginMiddleware(),
    createOpenApiRoutes({ version, enabled: config.openapiEnabled, source }),
    createTimezoneMiddleware({ defaultTimezone }),
    ...buildAgentRouteMiddlewares(bundle, config, logger),
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
    // Outside the agent-scoped chain on purpose: the viewer is a public page, the document it fetches
    // is not. Gated on the edge being mounted too, like the error middleware above: with no agent
    // chain there is no document to fetch, and the page would only ever reach a bare Koa 404.
    createDocsRoutes({
      enabled: config.openapiEnabled && agentMiddlewares.length > 0,
      documentPath: OPENAPI_PATH,
      logger,
    }),
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
