import type { AgentDispatcher } from './agent/in-process-transport';
import type { BFFConfig, ConfigLabels } from './config/env-config';
import type { BffHealth } from './http/health-route';
import type { EnvironmentIdResolver } from './oauth/environment-id';
import type { SessionStore } from './oauth/session-store';
import type { Logger } from './ports/logger-port';
import type { Metrics } from './ports/metrics-port';
import type { IncomingMessage, ServerResponse } from 'http';
import type { Middleware } from 'koa';

import { normalizeDomainList } from '@forestadmin/forestadmin-client';
import { bodyParser } from '@koa/bodyparser';
import Koa from 'koa';

import createConsoleLogger from './adapters/console-logger';
import {
  agentScoped,
  buildAgentMiddlewares,
  buildAiMiddlewares,
  resolveTransport,
} from './agent-edge';
import { AI_QUERY_ROUTE } from './ai/ai-routes-middleware';
import normalizeBasePath from './base-path';
import { labeler } from './config/env-config';
import warnMissingConfig from './config/missing-config-warning';
import createCorsMiddleware from './cors/cors-middleware';
import createDocsRoutes from './docs/docs-routes';
import createAccessLogMiddleware from './http/access-log-middleware';
import { unsupportedMediaType } from './http/bff-http-error';
import BODY_LIMIT, { AI_BODY_LIMIT } from './http/body-limit';
import createErrorMiddleware from './http/error-middleware';
import createHealthRoute, { describeHealth } from './http/health-route';
import createVersionHeaderMiddleware from './http/version-header-middleware';
import createEnvironmentIdResolver from './oauth/environment-id';
import ForestServerClient from './oauth/forest-server-client';
import createOAuthRoutes from './oauth/oauth-routes';
import createInMemorySessionStore from './oauth/session-store';
import createTokenCipher from './oauth/token-cipher';
import { OPENAPI_PATH } from './openapi/openapi-routes';
import version from './version';

export { resolveUnfoldSource } from './agent-edge';

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
  /**
   * Reaches an agent living in the same process, without a socket. When set, it replaces the HTTP
   * transport entirely: `AGENT_URL` then only names where the agent answers, never how it is called.
   */
  dispatcher?: AgentDispatcher;
  /**
   * Where the read-model reports its gauges. Defaults to the console sink, which is what the
   * standalone deployment wants; an embedding host passes its own, or a no-op.
   */
  metrics?: Metrics;
  /**
   * Domains of the OAuth clients allowed to sign in: a client passes when every redirect URI it
   * registered is an http(s) URI on a listed domain or a subdomain. Unset, any registered client
   * passes. Passed by the Gateway, never read from the environment.
   */
  allowedOAuthClients?: string[];
  /**
   * Sent as `X-Forest-Gateway-Version` on every response, next to agent-bff's own
   * `X-Forest-Bff-Version`. Unset or empty, the header is not sent: `forest-bff` keeps today's headers.
   */
  gatewayVersion?: string;
  labels?: ConfigLabels;
}

export interface Bff {
  callback: BffCallback;
  /**
   * Forget what was read from the SaaS. A host that knows the schema just moved — an agent
   * restarting on a customization refresh — calls this instead of waiting out the 24h TTL.
   */
  invalidate(): void;
  /**
   * Waits for the activity-log status transitions still in flight. They are fired without `await`,
   * so nothing else holds them: a host that stops without calling this leaves entries `pending`.
   * Absent when the deployment writes no activity log.
   *
   * `timeoutMs` is the host's shutdown deadline; the returned descriptions name what it cut short.
   */
  drainActivityLogs?: (timeoutMs?: number) => Promise<string[]>;
  health(): BffHealth;
}

const SESSION_TTL_SECONDS = 24 * 60 * 60;

const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH']);

const JSON_BODY_TYPES = ['application/json', 'application/*+json'];

function hasBody(ctx: Parameters<Middleware>[0]): boolean {
  return (ctx.request.length ?? 0) > 0 || ctx.get('transfer-encoding') !== '';
}

function createJsonOnlyGuard(): Middleware {
  return async function jsonOnlyGuard(ctx, next) {
    if (BODY_METHODS.has(ctx.method) && hasBody(ctx) && !ctx.is(JSON_BODY_TYPES)) {
      throw unsupportedMediaType();
    }

    await next();
  };
}

function createBodyParser(hasAiQueryRoute: boolean): Middleware {
  const extendTypes = { json: JSON_BODY_TYPES };
  const parseBody = bodyParser({ jsonLimit: BODY_LIMIT, extendTypes });

  if (!hasAiQueryRoute) return parseBody;

  const parseAiBody = bodyParser({
    jsonLimit: AI_BODY_LIMIT,
    enableTypes: ['json'],
    extendTypes,
  });

  return async function selectedBodyParser(ctx, next) {
    if (ctx.path === AI_QUERY_ROUTE) {
      await parseAiBody(ctx, next);

      return;
    }

    await parseBody(ctx, next);
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

export interface OAuthEdge {
  middlewares: Middleware[];
  resolveEnvironmentId?: EnvironmentIdResolver;
  session?: OAuthSession;
}

function buildOAuthMiddlewares(
  config: BFFConfig,
  logger: Logger,
  allowedOAuthClients: string[] | undefined,
): OAuthEdge {
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
    allowedOAuthClients,
  });

  return {
    middlewares: [oauthRoutes],
    resolveEnvironmentId,
    session: { store: sessionStore, serverClient, forestServerUrl },
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
  dispatcher,
  metrics,
  allowedOAuthClients,
  gatewayVersion,
  labels = {},
}: BuildBffOptions): Promise<Bff> {
  const label = labeler(labels);
  // Before anything is assembled: a mount the host does not serve must fail at boot, not surface as
  // a docs page that cannot load itself.
  const mountPath = normalizeBasePath(basePath);
  const allowedClientDomains = normalizeDomainList(allowedOAuthClients);

  warnMissingConfig(config, logger, labels);
  logger('Info', `Allowed origins: ${config.allowedOrigins.join(', ')}`);

  const transport = resolveTransport(config, dispatcher);
  const oauth = buildOAuthMiddlewares(config, logger, allowedClientDomains);
  const aiMiddlewares = buildAiMiddlewares(config, oauth, logger);
  const agentEdge = buildAgentMiddlewares(
    config,
    logger,
    oauth,
    aiMiddlewares,
    mountPath,
    transport,
    metrics,
    label('BFF_ALLOWED_ORIGINS'),
  );
  const agentMiddlewares = agentEdge.middlewares;
  const hasAgentEdge = agentMiddlewares.length > 0;
  const agentErrorMiddleware = hasAgentEdge ? [agentScoped(createErrorMiddleware({ logger }))] : [];
  const agentJsonOnlyGuard = hasAgentEdge ? [agentScoped(createJsonOnlyGuard())] : [];
  // Embedded, the rest is inherited from the agent, so there is no gap to report: a 503 here
  // would let a load balancer restart a process that serves api-key traffic fine. The auth
  // secret is still required — without it the agent edge is a stub and nothing authenticated
  // can be served, which is exactly what a probe must see.
  const health = describeHealth(
    (dispatcher !== undefined && Boolean(config.forestAuthSecret)) || config.hasAllRequired,
    version,
    {
      oauth: oauth.middlewares.length > 0,
      ai: aiMiddlewares.length > 0,
      cors: config.allowedOrigins.length > 0,
      openapi: config.openapiEnabled && agentMiddlewares.length > 0,
    },
  );

  const middlewares = [
    createAccessLogMiddleware({ logger, basePath: mountPath }),
    createVersionHeaderMiddleware(version, gatewayVersion),
    createHealthRoute({ health }),
    createCorsMiddleware({ allowedOrigins: config.allowedOrigins, logger }),
    ...agentErrorMiddleware,
    ...agentJsonOnlyGuard,
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

  const { activityLogs } = agentEdge;

  return {
    callback: app.callback(),
    invalidate: agentEdge.invalidate,
    drainActivityLogs: activityLogs && (timeoutMs => activityLogs.drain(timeoutMs)),
    health: () => ({ ...health, configured: { ...health.configured } }),
  };
}
