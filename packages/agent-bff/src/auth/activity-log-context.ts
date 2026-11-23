import type { Logger } from '../ports/logger-port';
import type { ActivityLogConfig } from '@forestadmin/agent-client';
import type { Context } from 'koa';

import { ActivityLogSource } from '@forestadmin/agent-client';

import { resolveForestServerToken, resolveRenderingId } from './forest-server-token-middleware';
import { invalidateApiKeyIdentity } from '../api-key/api-key-middleware';
import { sessionExpired } from '../http/bff-http-error';

const NO_RENDERING_MESSAGE = 'This request carries no usable rendering';

export default function activityLogConfigOf(
  ctx: Context,
  forestServerUrl: string,
  logger: Logger,
): ActivityLogConfig {
  const renderingId = resolveRenderingId(ctx);

  if (renderingId === undefined) throw sessionExpired(NO_RENDERING_MESSAGE);

  return {
    forestServer: {
      serverUrl: forestServerUrl,
      serverToken: () => resolveForestServerToken(ctx),
      renderingId,
    },
    activityLog: {
      source: ActivityLogSource.BFF,
      logger,
      onExpiredCredential: () => invalidateApiKeyIdentity(ctx),
    },
  };
}

export function readActivityLogConfigOf(
  ctx: Context,
  forestServerUrl: string,
  logger: Logger,
): ActivityLogConfig | undefined {
  if (resolveRenderingId(ctx) === undefined) {
    logger('Warn', `${NO_RENDERING_MESSAGE}: the read runs without an activity log`);

    return undefined;
  }

  return activityLogConfigOf(ctx, forestServerUrl, logger);
}
