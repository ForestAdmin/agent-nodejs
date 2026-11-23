import type { Logger } from '../ports/logger-port';
import type { ActivityLogContext } from '@forestadmin/agent-client';
import type { ActivityLogsServiceInterface } from '@forestadmin/forestadmin-client';
import type { Context } from 'koa';

import { ActivityLogsService, ForestHttpApi } from '@forestadmin/forestadmin-client';

import { resolveForestServerToken, resolveRenderingId } from './forest-server-token-middleware';
import { invalidateApiKeyIdentity } from '../api-key/api-key-middleware';
import { sessionExpired } from '../http/bff-http-error';

export const APPLICATION_SOURCE_HEADER = 'Forest-Application-Source';
export const BFF_APPLICATION_SOURCE = 'BFF';

const NO_RENDERING_MESSAGE = 'This request carries no usable rendering';

/**
 * Its own instance rather than the client `oauth/forest-server-client.ts` already holds:
 * `ForestAdminClientOptions` carries no `headers`, so that one cannot tell the server which channel
 * wrote the log.
 */
export function createBffActivityLogsService(
  forestServerUrl: string,
): ActivityLogsServiceInterface {
  return new ActivityLogsService(new ForestHttpApi(), {
    forestServerUrl,
    headers: { [APPLICATION_SOURCE_HEADER]: BFF_APPLICATION_SOURCE },
  });
}

export function activityLogContextOf(
  ctx: Context,
  service: ActivityLogsServiceInterface,
  logger: Logger,
): ActivityLogContext {
  return {
    service,
    logger,
    credentials: async () => {
      const renderingId = resolveRenderingId(ctx);

      if (renderingId === undefined) throw sessionExpired(NO_RENDERING_MESSAGE);

      return { forestServerToken: await resolveForestServerToken(ctx), renderingId };
    },
    onExpiredCredential: () => invalidateApiKeyIdentity(ctx),
  };
}
