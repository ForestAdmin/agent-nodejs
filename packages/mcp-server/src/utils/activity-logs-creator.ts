import type {
  ActivityLogAction,
  ActivityLogResponse,
  ActivityLogType,
  ForestServerClient,
} from '../http-client';
import type { Logger } from '../server';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js';

import { NotFoundError } from '@forestadmin/forestadmin-client';

export type { ActivityLogAction, ActivityLogResponse };

const ACTION_TO_TYPE: Record<ActivityLogAction, ActivityLogType> = {
  index: 'read',
  search: 'read',
  filter: 'read',
  action: 'write',
  create: 'write',
  update: 'write',
  delete: 'write',
  listRelatedData: 'read',
  describeCollection: 'read',
};

function getAuthContext(request: RequestHandlerExtra<ServerRequest, ServerNotification>): {
  forestServerToken: string;
  renderingId: string;
} {
  const forestServerToken = request.authInfo?.extra?.forestServerToken;
  const renderingId = request.authInfo?.extra?.renderingId;

  if (!forestServerToken || typeof forestServerToken !== 'string') {
    throw new Error('Invalid or missing forestServerToken in authentication context');
  }

  // renderingId can be number (from JWT) or string - convert to string for API calls
  if (renderingId === undefined || renderingId === null) {
    throw new Error('Invalid or missing renderingId in authentication context');
  }

  return { forestServerToken, renderingId: String(renderingId) };
}

export default async function createPendingActivityLog(
  forestServerClient: ForestServerClient,
  request: RequestHandlerExtra<ServerRequest, ServerNotification>,
  action: ActivityLogAction,
  extra?: {
    collectionName?: string;
    recordId?: string | number;
    recordIds?: string[] | number[];
    label?: string;
  },
) {
  const type = ACTION_TO_TYPE[action];
  const { forestServerToken, renderingId } = getAuthContext(request);

  return forestServerClient.createActivityLog({
    forestServerToken,
    renderingId,
    action,
    type,
    collectionName: extra?.collectionName,
    recordId: extra?.recordId,
    recordIds: extra?.recordIds,
    label: extra?.label,
  });
}

interface UpdateActivityLogOptions {
  forestServerClient: ForestServerClient;
  request: RequestHandlerExtra<ServerRequest, ServerNotification>;
  activityLog: ActivityLogResponse;
  status: 'completed' | 'failed';
  errorMessage?: string;
  logger: Logger;
}

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 500;

async function updateActivityLogStatus(
  options: UpdateActivityLogOptions,
  attempt = 1,
): Promise<void> {
  const { forestServerClient, request, activityLog, status, errorMessage, logger } = options;

  // Use optional chaining with fallback since we're in error handling context
  // and don't want to throw a different error if auth context is missing
  const forestServerToken = (request.authInfo?.extra?.forestServerToken as string) ?? '';

  try {
    await forestServerClient.updateActivityLogStatus({
      forestServerToken,
      activityLog,
      status,
      errorMessage,
    });
  } catch (error) {
    // Retry on 404 errors (activity log may not be immediately available)
    if (error instanceof NotFoundError && attempt < MAX_RETRIES) {
      logger('Debug', `Activity log not found (attempt ${attempt}/${MAX_RETRIES}), retrying...`);
      await new Promise<void>(resolve => {
        setTimeout(resolve, RETRY_DELAY_MS);
      });

      return updateActivityLogStatus(options, attempt + 1);
    }

    const errorMsg = error instanceof Error ? error.message : String(error);
    logger('Error', `Failed to update activity log status to '${status}': ${errorMsg}`);

    // Rethrow so callers are aware of the failure
    throw error;
  }
}

interface MarkActivityLogAsFailedOptions {
  forestServerClient: ForestServerClient;
  request: RequestHandlerExtra<ServerRequest, ServerNotification>;
  activityLog: ActivityLogResponse;
  errorMessage: string;
  logger: Logger;
}

export function markActivityLogAsFailed(options: MarkActivityLogAsFailedOptions): void {
  const { forestServerClient, request, activityLog, errorMessage, logger } = options;
  // Fire-and-forget: don't block error response on activity log update
  updateActivityLogStatus({
    forestServerClient,
    request,
    activityLog,
    status: 'failed',
    errorMessage,
    logger,
  }).catch(error => {
    logger('Error', `Unexpected error updating activity log to 'failed': ${error}`);
  });
}

interface MarkActivityLogAsSucceededOptions {
  forestServerClient: ForestServerClient;
  request: RequestHandlerExtra<ServerRequest, ServerNotification>;
  activityLog: ActivityLogResponse;
  logger: Logger;
}

export function markActivityLogAsSucceeded(options: MarkActivityLogAsSucceededOptions): void {
  const { forestServerClient, request, activityLog, logger } = options;
  // Fire-and-forget: don't block successful response on activity log update
  updateActivityLogStatus({
    forestServerClient,
    request,
    activityLog,
    status: 'completed',
    logger,
  }).catch(error => {
    logger('Error', `Unexpected error updating activity log to 'succeeded': ${error}`);
  });
}
