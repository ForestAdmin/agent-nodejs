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

import getAuthContext from './auth-context';

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
  triggerWorkflow: 'write',
};

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

  const activityLog = await forestServerClient.createMcpActivityLog({
    forestServerToken,
    renderingId,
    action,
    type,
    collectionName: extra?.collectionName,
    recordId: extra?.recordId,
    recordIds: extra?.recordIds,
    label: extra?.label,
  });

  // The server answers HTTP 200 with a null id when the audit write is dropped
  // (audit store down, or a collection that no longer exists). Write actions are
  // fail-closed: reject so withActivityLog blocks the operation instead of proceeding
  // with no audit trail. Read actions are fail-open: return null so the operation
  // proceeds (skipping status tracking) — an audit-store outage must not take down
  // the whole read surface.
  if (activityLog?.id === null || activityLog?.id === undefined) {
    if (type === 'write') {
      throw new Error(
        'Failed to create activity log: the server returned no activity log id. ' +
          'Blocking the operation to preserve the audit trail.',
      );
    }

    return null;
  }

  return activityLog;
}

interface UpdateActivityLogOptions {
  forestServerClient: ForestServerClient;
  request: RequestHandlerExtra<ServerRequest, ServerNotification>;
  activityLog: ActivityLogResponse;
  status: 'completed' | 'failed';
  logger: Logger;
}

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 500;

async function updateActivityLogStatus(
  options: UpdateActivityLogOptions,
  attempt = 1,
): Promise<void> {
  const { forestServerClient, request, activityLog, status, logger } = options;

  // Use optional chaining with fallback since we're in error handling context
  // and don't want to throw a different error if auth context is missing
  const forestServerToken = (request.authInfo?.extra?.forestServerToken as string) ?? '';

  try {
    await forestServerClient.updateActivityLogStatus({
      forestServerToken,
      activityLog,
      status,
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
  logger: Logger;
}

export function markActivityLogAsFailed(options: MarkActivityLogAsFailedOptions): void {
  const { forestServerClient, request, activityLog, logger } = options;
  // Fire-and-forget: don't block error response on activity log update
  updateActivityLogStatus({
    forestServerClient,
    request,
    activityLog,
    status: 'failed',
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
