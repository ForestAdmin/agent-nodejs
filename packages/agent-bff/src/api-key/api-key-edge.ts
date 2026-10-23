import type { BFFConfig } from '../config/env-config';
import type { Logger } from '../ports/logger-port';
import type { Middleware } from 'koa';

import createApiKeyAuthenticator from './api-key-authenticator';
import ApiKeyClient from './api-key-client';
import createApiKeyMiddleware from './api-key-middleware';
import createResolveCache from './resolve-cache';
import { unauthorized } from '../http/bff-http-error';

export interface ResolvedApiKeyConfig {
  forestServerUrl: string;
  forestEnvSecret: string;
  forestAuthSecret: string;
}

export function resolveApiKeyConfig(config: BFFConfig): ResolvedApiKeyConfig | undefined {
  const { forestServerUrl, forestEnvSecret, forestAuthSecret } = config;

  if (forestServerUrl && forestEnvSecret && forestAuthSecret) {
    return { forestServerUrl, forestEnvSecret, forestAuthSecret };
  }

  return undefined;
}

export function buildApiKeyMiddleware(config: BFFConfig, logger: Logger): Middleware | undefined {
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

export function createApiKeyUnavailableGuard(logger: Logger): Middleware {
  return async function apiKeyUnavailableGuard(ctx, next) {
    if (ctx.state.authMode === 'api-key') {
      logger('Error', 'API key auth requested but the resolver is not configured');
      throw unauthorized('Credentials could not be validated');
    }

    await next();
  };
}
