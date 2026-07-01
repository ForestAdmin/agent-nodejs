import type { BFFConfig } from './config/env-config';
import type { Logger } from './ports/logger-port';
import type { Middleware } from 'koa';

import { bodyParser } from '@koa/bodyparser';

import createConsoleLogger from './adapters/console-logger';
import createApiKeyAuthenticator from './api-key/api-key-authenticator';
import ApiKeyClient from './api-key/api-key-client';
import createApiKeyMiddleware from './api-key/api-key-middleware';
import createResolveCache from './api-key/resolve-cache';
import { parseConfig } from './config/env-config';
import { extractErrorMessage } from './errors';
import BFFHttpServer from './http/bff-http-server';
import ForestServerClient from './oauth/forest-server-client';
import createOAuthRoutes from './oauth/oauth-routes';
import createInMemorySessionStore from './oauth/session-store';
import createTokenCipher from './oauth/token-cipher';
import version from './version';

const BODY_LIMIT = '16kb';
const SESSION_TTL_SECONDS = 24 * 60 * 60;

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

  return [bodyParser({ jsonLimit: BODY_LIMIT }), oauthRoutes];
}

interface ResolvedApiKeyConfig {
  forestServerUrl: string;
  forestEnvSecret: string;
  forestAuthSecret: string;
}

function resolveApiKeyConfig(config: BFFConfig): ResolvedApiKeyConfig | undefined {
  const { forestServerUrl, forestEnvSecret, forestAuthSecret, agentUrl } = config;

  if (forestServerUrl && forestEnvSecret && forestAuthSecret && agentUrl) {
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

export default async function runCli(
  env: NodeJS.ProcessEnv,
  logger: Logger = createConsoleLogger(),
): Promise<BFFHttpServer> {
  const config = parseConfig(env);
  const oauthMiddlewares = await buildOAuthMiddlewares(config, logger);
  const apiKeyMiddleware = buildApiKeyMiddleware(config, logger);
  const middlewares = [...oauthMiddlewares, ...(apiKeyMiddleware ? [apiKeyMiddleware] : [])];
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
