import type { ActivityLogWriter } from './activity-log/activity-log-writer';
import type { AgentTransport } from './agent/agent-transport';
import type { AgentDispatcher } from './agent/in-process-transport';
import type { ResolvedApiKeyConfig } from './api-key/api-key-edge';
import type { OAuthEdge } from './build-bff';
import type { BFFConfig } from './config/env-config';
import type { UnfoldSource } from './openapi/unfolded-document';
import type { Logger } from './ports/logger-port';
import type { Metrics } from './ports/metrics-port';
import type ReadModelStore from './read-model/read-model-store';
import type { Middleware } from 'koa';

import createActionRoutesMiddleware from './action/action-routes-middleware';
import createActivityLogWriter from './activity-log/activity-log-writer';
import createBffActivityLogsService from './activity-log/activity-logs-service';
import createAgentStubMiddleware from './agent/agent-stub';
import { createHttpTransport } from './agent/agent-transport';
import createInProcessTransport from './agent/in-process-transport';
import AiProxyClient from './ai/ai-proxy-client';
import createAiRoutesMiddleware from './ai/ai-routes-middleware';
import {
  buildApiKeyMiddleware,
  createApiKeyUnavailableGuard,
  resolveApiKeyConfig,
} from './api-key/api-key-edge';
import createAuthModeMiddleware from './auth/auth-mode-middleware';
import createForestServerTokenMiddleware from './auth/forest-server-token-middleware';
import createContextRoutesMiddleware from './context/context-routes-middleware';
import createPerKeyOriginMiddleware from './cors/per-key-origin';
import createDataRoutesMiddleware from './data/data-routes-middleware';
import { tolerateEnvironmentIdFailure } from './oauth/environment-id';
import createOpenApiRoutes from './openapi/openapi-routes';
import PermissionsCache from './permissions/permissions-cache';
import PermissionsClient from './permissions/permissions-client';
import createPermissionsRoutesMiddleware from './permissions/permissions-routes-middleware';
import isAgentPath from './rate-limit/agent-path';
import createRateLimitMiddleware from './rate-limit/rate-limit-middleware';
import createReadModel from './read-model/create-read-model';
import createTimezoneMiddleware from './timezone/timezone-middleware';
import version from './version';

export function agentScoped(middleware: Middleware): Middleware {
  return async function scoped(ctx, next) {
    if (!isAgentPath(ctx.path)) {
      await next();

      return;
    }

    await middleware(ctx, next);
  };
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
 * How this deployment reaches the agent: in-process when a dispatcher was handed over, over HTTP
 * when an AGENT_URL was configured, and not at all otherwise — which is what makes the data and
 * action routes fall back to their stub.
 */
export function resolveTransport(
  config: BFFConfig,
  dispatcher: AgentDispatcher | undefined,
): AgentTransport | undefined {
  const timeoutMs = config.agentTimeoutMs;

  if (dispatcher) return createInProcessTransport({ dispatcher, timeoutMs });
  if (config.agentUrl) return createHttpTransport({ agentUrl: config.agentUrl, timeoutMs });

  return undefined;
}

/**
 * When unfolding is possible, in ONE place: the document needs the AGENT_URL the store does not,
 * because a collection's field set comes from the agent capabilities. The server passes the bundle it
 * already built for the data routes; the CLI goes through `resolveUnfoldSource`. Silent on purpose —
 * the two report a missing configuration differently.
 */
function toUnfoldSource(
  bundle: ReadModelBundle | undefined,
  transport: AgentTransport | undefined,
  logger: Logger,
): UnfoldSource | undefined {
  if (!bundle || !transport) return undefined;

  return { store: bundle.store, transport, logger };
}

/**
 * Metrics are dropped rather than logged: without an explicit sink `createReadModel` builds a console
 * one, which reports gauges at `Info`, and `createConsoleLogger` sends `Info` to `console.info` — the
 * stdout the document is written to. The server keeps its metrics; the export has no sink for them
 * anyway.
 */
const UNMEASURED: Metrics = { increment: () => undefined, gauge: () => undefined };

export function resolveUnfoldSource(config: BFFConfig, logger: Logger): UnfoldSource | undefined {
  return toUnfoldSource(
    resolveReadModelBundle(config, logger, UNMEASURED),
    resolveTransport(config, undefined),
    logger,
  );
}

// The routes that write an activity log come with the writer holding their pending transitions, so
// the host can drain it when it stops.
interface AgentRouteEdge {
  middlewares: Middleware[];
  activityLogs?: ActivityLogWriter;
}

// The data middleware falls through to the action middleware on a non-data path.
function buildAgentRouteMiddlewares(
  bundle: ReadModelBundle | undefined,
  transport: AgentTransport | undefined,
  logger: Logger,
  permissionsCache: PermissionsCache,
): AgentRouteEdge {
  if (!bundle) {
    logger(
      'Warn',
      'Data, action and permissions endpoints disabled: FOREST_SERVER_URL, FOREST_ENV_SECRET or FOREST_AUTH_SECRET is missing',
    );

    return { middlewares: [createAgentStubMiddleware()] };
  }

  const { store, apiKeyConfig } = bundle;

  const permissionsMiddleware = createPermissionsRoutesMiddleware({
    store,
    client: new PermissionsClient({
      forestServerUrl: apiKeyConfig.forestServerUrl,
      envSecret: apiKeyConfig.forestEnvSecret,
    }),
    cache: permissionsCache,
    logger,
  });

  if (!transport) {
    logger('Warn', 'Data and action endpoints disabled: AGENT_URL is missing');

    return { middlewares: [permissionsMiddleware, createAgentStubMiddleware()] };
  }

  const activityLogs = createActivityLogWriter({
    service: createBffActivityLogsService(apiKeyConfig.forestServerUrl),
    logger,
  });

  return {
    middlewares: [
      permissionsMiddleware,
      createDataRoutesMiddleware({ store, transport, logger, activityLogs }),
      createActionRoutesMiddleware({ store, transport, logger, activityLogs }),
    ],
    activityLogs,
  };
}

export function buildAiMiddlewares(
  config: BFFConfig,
  oauth: OAuthEdge,
  logger: Logger,
): Middleware[] {
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
  activityLogs?: ActivityLogWriter;
}

export function buildAgentMiddlewares(
  config: BFFConfig,
  logger: Logger,
  oauth: OAuthEdge,
  aiMiddlewares: Middleware[],
  basePath: string,
  transport: AgentTransport | undefined,
  metrics: Metrics | undefined,
  allowedOriginsLabel = 'BFF_ALLOWED_ORIGINS',
): AgentEdge {
  const { forestAuthSecret, defaultTimezone } = config;

  if (!forestAuthSecret) {
    logger('Warn', 'Agent edge disabled: FOREST_AUTH_SECRET is missing');

    return { middlewares: [], invalidate: () => undefined };
  }

  const apiKeyStep = buildApiKeyMiddleware(config, logger) ?? createApiKeyUnavailableGuard(logger);
  // One store for the whole edge. The document only unfolds when the agent is reachable too: with no
  // AGENT_URL every data path answers 501, so concrete paths would advertise a dead surface.
  const bundle = resolveReadModelBundle(config, logger, metrics);
  const source = toUnfoldSource(bundle, transport, logger);
  const permissionsCache = new PermissionsCache();
  const routeEdge = buildAgentRouteMiddlewares(bundle, transport, logger, permissionsCache);

  const chain: Middleware[] = [
    createAuthModeMiddleware({ authSecret: forestAuthSecret }),
    apiKeyStep,
    // After both auth middlewares: the resolver it lands reads what they put on the context.
    createForestServerTokenMiddleware({ session: oauth.session, logger }),
    createRateLimitMiddleware({
      maxRequests: config.rateLimitMaxRequests,
      windowMs: config.rateLimitWindowMs,
    }),
    createPerKeyOriginMiddleware({
      logger,
      serverAllowedOrigins: config.allowedOrigins,
      allowedOriginsLabel,
    }),
    createOpenApiRoutes({
      version,
      enabled: config.openapiEnabled,
      source,
      hasAiQueryRoute: aiMiddlewares.length > 0,
      publicUrl: config.publicUrl,
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
    ...routeEdge.middlewares,
  ];

  return {
    middlewares: chain.map(agentScoped),
    invalidate: () => {
      // The one trace an invalidation leaves: the operator asked "the schema is wrong" needs to
      // establish that one happened and when, and the age gauge cannot say it.
      logger('Info', 'Dropping the SaaS read caches on host request');
      bundle?.store.invalidate();
      permissionsCache.clear();
    },
    activityLogs: routeEdge.activityLogs,
  };
}
