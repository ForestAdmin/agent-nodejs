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

/**
 * Fail policy for the audit trail, keyed by action type: a write whose activity log cannot be
 * created is blocked (no unaudited side effect), while a read proceeds with a warning (an audit
 * store outage must not take down the read surface). Both the refusal/outage path and the
 * 200-with-no-id path in `createPendingActivityLog` are arbitrated by this map.
 */
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
  // Outside the fail policy below: a missing auth context is a caller bug, not an audit outage.
  const { forestServerToken, renderingId } = getAuthContext(request);

  let activityLog: ActivityLogResponse | undefined;

  try {
    activityLog = await forestServerClient.createMcpActivityLog({
      forestServerToken,
      renderingId,
      action,
      type,
      collectionName: extra?.collectionName,
      recordId: extra?.recordId,
      recordIds: extra?.recordIds,
      label: extra?.label,
    });
  } catch (error) {
    // The audit log was refused (400/404 — e.g. an unresolvable collection) or the store is
    // unreachable (5xx, timeout, connection error). Both land here, and both are far more likely
    // than the 200-with-null-id case below.
    if (type === 'write') throw error;

    return null;
  }

  // 200 with no id: the route answered but the audit store dropped the write.
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

  // Read directly rather than through getAuthContext: this runs in a fire-and-forget path and must
  // not throw a second, unrelated error. A missing token means the request cannot be authenticated,
  // so skip the call - sending an empty Bearer would 401 and then be retried on the 404 branch.
  const forestServerToken = request.authInfo?.extra?.forestServerToken;

  if (typeof forestServerToken !== 'string' || !forestServerToken) {
    logger(
      'Error',
      `Cannot update activity log status to '${status}': no forestServerToken in the auth context.`,
    );

    return;
  }

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
