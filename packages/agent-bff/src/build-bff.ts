import type { BFFConfig } from './config/env-config';
import type { EnvironmentIdResolver } from './oauth/environment-id';
import type { SessionStore } from './oauth/session-store';
import type { UnfoldSource } from './openapi/unfolded-document';
import type { Logger } from './ports/logger-port';
import type { Metrics } from './ports/metrics-port';
import type ReadModelStore from './read-model/read-model-store';
import type { IncomingMessage, ServerResponse } from 'http';
import type { Middleware } from 'koa';

import { bodyParser } from '@koa/bodyparser';
import Koa from 'koa';

import createActionRoutesMiddleware from './action/action-routes-middleware';
import createConsoleLogger from './adapters/console-logger';
import createAgentStubMiddleware from './agent/agent-stub';
import { createHttpTransport } from './agent/agent-transport';
import AiProxyClient from './ai/ai-proxy-client';
import createAiRoutesMiddleware, { AI_QUERY_ROUTE } from './ai/ai-routes-middleware';
import createApiKeyAuthenticator from './api-key/api-key-authenticator';
import ApiKeyClient from './api-key/api-key-client';
import createApiKeyMiddleware from './api-key/api-key-middleware';
import createResolveCache from './api-key/resolve-cache';
import createAuthModeMiddleware from './auth/auth-mode-middleware';
import normalizeBasePath from './base-path';
import warnMissingConfig from './config/missing-config-warning';
import createContextRoutesMiddleware from './context/context-routes-middleware';
import createCorsMiddleware from './cors/cors-middleware';
import createPerKeyOriginMiddleware from './cors/per-key-origin';
import createDataRoutesMiddleware from './data/data-routes-middleware';
import createDocsRoutes from './docs/docs-routes';
import { unauthorized } from './http/bff-http-error';
import BODY_LIMIT, { AI_BODY_LIMIT } from './http/body-limit';
import createErrorMiddleware from './http/error-middleware';
import createHealthRoute from './http/health-route';
import createVersionHeaderMiddleware from './http/version-header-middleware';
import createEnvironmentIdResolver, { tolerateEnvironmentIdFailure } from './oauth/environment-id';
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

/** What a host must hand to `http.createServer`, or mount, to serve the BFF. */
export type BffCallback = (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;

export interface BuildBffOptions {
  config: BFFConfig;
  logger?: Logger;
  /**
   * Prefix the host serves this BFF under, `/bff` for an embedded one. Routing is the host's job —
   * it strips the prefix before the request lands here — but the paths the BFF *emits* (the OpenAPI
   * `servers` entry, the docs page's asset and document urls) must carry it.
   *
   * A plain path prefix, with or without its leading slash; `'/'` and `''` both mean the BFF owns the
   * origin root. Normalized by `normalizeBasePath`, which throws on anything else.
   */
  basePath?: string;
}

export interface Bff {
  callback: BffCallback;
  /**
   * Forget what was read from the SaaS. A host that knows the schema just moved — an agent
   * restarting on a customization refresh — calls this instead of waiting out the 24h TTL.
   */
  invalidate(): void;
}

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

function createBodyParser(hasAiQueryRoute: boolean): Middleware {
  const parseBody = bodyParser({ jsonLimit: BODY_LIMIT });

  if (!hasAiQueryRoute) return parseBody;

  const parseAiBody = bodyParser({ jsonLimit: AI_BODY_LIMIT, enableTypes: ['json'] });

  return async function selectedBodyParser(ctx, next) {
    if (ctx.path === AI_QUERY_ROUTE) {
      await parseAiBody(ctx, next);

      return;
    }

    await parseBody(ctx, next);
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

export function resolveOAuthConfig(config: BFFConfig): ResolvedOAuthConfig | undefined {
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

interface OAuthSession {
  store: SessionStore;
  serverClient: ForestServerClient;
  forestServerUrl: string;
}

interface OAuthEdge {
  middlewares: Middleware[];
  resolveEnvironmentId?: EnvironmentIdResolver;
  session?: OAuthSession;
}

function buildOAuthMiddlewares(config: BFFConfig, logger: Logger): OAuthEdge {
  const oauthConfig = resolveOAuthConfig(config);

  if (!oauthConfig) {
    logger('Warn', 'OAuth routes disabled: required configuration is missing');

    return { middlewares: [] };
  }

  const { forestServerUrl, forestEnvSecret, forestAppUrl, forestAuthSecret, tokenEncryptionKey } =
    oauthConfig;

  const serverClient = new ForestServerClient({ forestServerUrl, envSecret: forestEnvSecret });
  const resolveEnvironmentId = createEnvironmentIdResolver(serverClient);

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
    resolveEnvironmentId,
    logger,
  });

  return {
    middlewares: [oauthRoutes],
    resolveEnvironmentId,
    session: { store: sessionStore, serverClient, forestServerUrl },
  };
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

interface ReadModelBundle {
  store: ReadModelStore;
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
): ReadModelBundle | undefined {
  const apiKeyConfig = resolveApiKeyConfig(config);

  if (!apiKeyConfig) return undefined;

  const { store } = createReadModel({
    forestServerUrl: apiKeyConfig.forestServerUrl,
    envSecret: apiKeyConfig.forestEnvSecret,
    logger,
    metrics,
  });

  return { store, apiKeyConfig };
}

/**
 * When unfolding is possible, in ONE place: the document needs the AGENT_URL the store does not,
 * because a collection's field set comes from the agent capabilities. The server passes the bundle it
 * already built for the data routes; the CLI goes through `resolveUnfoldSource`. Silent on purpose —
 * the two report a missing configuration differently.
 */
function toUnfoldSource(
  bundle: ReadModelBundle | undefined,
  config: BFFConfig,
  logger: Logger,
): UnfoldSource | undefined {
  if (!bundle || !config.agentUrl) return undefined;

  return {
    store: bundle.store,
    transport: createHttpTransport({
      agentUrl: config.agentUrl,
      timeoutMs: config.agentTimeoutMs,
    }),
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
  bundle: ReadModelBundle | undefined,
  config: BFFConfig,
  logger: Logger,
  permissionsCache: PermissionsCache,
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
    cache: permissionsCache,
    logger,
  });

  if (!agentUrl) {
    logger('Warn', 'Data and action endpoints disabled: AGENT_URL is missing');

    return [permissionsMiddleware, createAgentStubMiddleware()];
  }

  const transport = createHttpTransport({ agentUrl, timeoutMs });

  return [
    permissionsMiddleware,
    createDataRoutesMiddleware({ store, transport, logger }),
    createActionRoutesMiddleware({ store, transport, logger }),
  ];
}

function buildAiMiddlewares(config: BFFConfig, oauth: OAuthEdge, logger: Logger): Middleware[] {
  const { session, resolveEnvironmentId } = oauth;

  if (!session) {
    logger('Warn', 'AI query route disabled: the deployment carries no OAuth session');

    return [];
  }

  const client = new AiProxyClient({
    forestServerUrl: session.forestServerUrl,
    timeoutMs: config.aiTimeoutMs,
  });

  return [
    createAiRoutesMiddleware({
      client,
      sessionStore: session.store,
      serverClient: session.serverClient,
      resolveEnvironmentId,
      logger,
    }),
  ];
}

interface AgentEdge {
  middlewares: Middleware[];
  invalidate(): void;
}

function buildAgentMiddlewares(
  config: BFFConfig,
  logger: Logger,
  oauth: OAuthEdge,
  aiMiddlewares: Middleware[],
  basePath: string,
): AgentEdge {
  const { forestAuthSecret, defaultTimezone } = config;

  if (!forestAuthSecret) {
    logger('Warn', 'Agent edge disabled: FOREST_AUTH_SECRET is missing');

    return { middlewares: [], invalidate: () => undefined };
  }

  const apiKeyStep = buildApiKeyMiddleware(config, logger) ?? createApiKeyUnavailableGuard(logger);
  // One store for the whole edge. The document only unfolds when the agent is reachable too: with no
  // AGENT_URL every data path answers 501, so concrete paths would advertise a dead surface.
  const bundle = resolveReadModelBundle(config, logger);
  const source = toUnfoldSource(bundle, config, logger);
  const permissionsCache = new PermissionsCache();

  const chain: Middleware[] = [
    createAuthModeMiddleware({ authSecret: forestAuthSecret }),
    apiKeyStep,
    createPerKeyOriginMiddleware(),
    createOpenApiRoutes({
      version,
      enabled: config.openapiEnabled,
      source,
      hasAiQueryRoute: aiMiddlewares.length > 0,
      basePath,
    }),
    ...(bundle
      ? [
          createContextRoutesMiddleware({
            store: bundle.store,
            resolveEnvironmentId: oauth.resolveEnvironmentId
              ? tolerateEnvironmentIdFailure(oauth.resolveEnvironmentId, logger)
              : undefined,
          }),
        ]
      : []),
    ...aiMiddlewares,
    createTimezoneMiddleware({ defaultTimezone }),
    ...buildAgentRouteMiddlewares(bundle, config, logger, permissionsCache),
  ];

  return {
    middlewares: chain.map(agentScoped),
    invalidate: () => {
      bundle?.store.invalidate();
      permissionsCache.clear();
    },
  };
}

/**
 * Assemble the whole BFF — `/health`, the version header, and every middleware in the one order both
 * deployment modes must share — and hand back the request handler. `runCli` puts it behind a
 * listener; an embedding host mounts it at the root of its own server. The handler is terminal — it
 * answers 404 itself instead of yielding to a host `next()` — and every path it serves is absolute,
 * so a prefix mount would move `/health` and `/agent/...` off the paths the frontend calls.
 */
export default async function buildBff({
  config,
  logger = createConsoleLogger(),
  basePath,
}: BuildBffOptions): Promise<Bff> {
  // Before anything is assembled: a mount the host does not serve must fail at boot, not surface as
  // a docs page that cannot load itself.
  const mountPath = normalizeBasePath(basePath);

  if (config.invalidAllowedOrigins.length > 0) {
    logger('Warn', 'Ignoring malformed BFF_ALLOWED_ORIGINS entries', {
      entries: config.invalidAllowedOrigins,
    });
  }

  warnMissingConfig(config, logger);

  const oauth = buildOAuthMiddlewares(config, logger);
  const aiMiddlewares = buildAiMiddlewares(config, oauth, logger);
  const agentEdge = buildAgentMiddlewares(config, logger, oauth, aiMiddlewares, mountPath);
  const agentMiddlewares = agentEdge.middlewares;
  const agentErrorMiddleware =
    agentMiddlewares.length > 0 ? [agentScoped(createErrorMiddleware({ logger }))] : [];

  const middlewares = [
    createVersionHeaderMiddleware(version),
    createHealthRoute({ config, version }),
    createCorsMiddleware({ allowedOrigins: config.allowedOrigins }),
    ...agentErrorMiddleware,
    createBodyParser(aiMiddlewares.length > 0),
    ...oauth.middlewares,
    // Outside the agent-scoped chain on purpose: the viewer is a public page, the document it fetches
    // is not. Gated on the edge being mounted too, like the error middleware above: with no agent
    // chain there is no document to fetch, and the page would only ever reach a bare Koa 404.
    createDocsRoutes({
      enabled: config.openapiEnabled && agentMiddlewares.length > 0,
      documentPath: OPENAPI_PATH,
      basePath: mountPath,
      logger,
    }),
    ...agentMiddlewares,
  ];

  const app = new Koa();
  for (const middleware of middlewares) app.use(middleware);

  return { callback: app.callback(), invalidate: agentEdge.invalidate };
}
