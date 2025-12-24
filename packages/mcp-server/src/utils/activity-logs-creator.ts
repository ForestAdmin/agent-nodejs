import type { Logger } from '../server.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

/**
 * Valid activity log actions.
 * These must match ActivityLogActions enum in forestadmin-server.
 * @see packages/private-api/src/config/activity-logs.ts
 */
export type ActivityLogAction =
  | 'index'
  | 'search'
  | 'filter'
  | 'action'
  | 'create'
  | 'update'
  | 'delete'
  | 'listRelatedData';

const ACTION_TO_TYPE: Record<ActivityLogAction, 'read' | 'write'> = {
  index: 'read',
  search: 'read',
  filter: 'read',
  action: 'write',
  create: 'write',
  update: 'write',
  delete: 'write',
  listRelatedData: 'read',
};

type ActivityLogResponse = {
  id: string;
  attributes: {
    index: string;
  };
};

export default async function createPendingActivityLog(
  forestServerUrl: string,
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

  const forestServerToken = request.authInfo?.extra?.forestServerToken as string;
  const renderingId = request.authInfo?.extra?.renderingId as string;

  const response = await fetch(`${forestServerUrl}/api/activity-logs-requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Forest-Application-Source': 'MCP',
      Authorization: `Bearer ${forestServerToken}`,
    },
    body: JSON.stringify({
      data: {
        id: 1,
        type: 'activity-logs-requests',
        attributes: {
          type,
          action,
          label: extra?.label,
          status: 'pending',
          records: (extra?.recordIds || (extra?.recordId ? [extra.recordId] : [])) as string[],
        },
        relationships: {
          rendering: {
            data: {
              id: renderingId,
              type: 'renderings',
            },
          },
          collection: {
            data: extra?.collectionName
              ? {
                  id: extra.collectionName,
                  type: 'collections',
                }
              : null,
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create activity log: ${await response.text()}`);
  }

  const { data: activityLog } = (await response.json()) as { data: ActivityLogResponse };

  return activityLog;
}

interface UpdateActivityLogOptions {
  forestServerUrl: string;
  request: RequestHandlerExtra<ServerRequest, ServerNotification>;
  activityLog: ActivityLogResponse;
  status: 'succeeded' | 'failed';
  errorMessage?: string;
  logger: Logger;
}

async function updateActivityLogStatus(options: UpdateActivityLogOptions): Promise<void> {
  const { forestServerUrl, request, activityLog, status, errorMessage, logger } = options;
  const forestServerToken = request.authInfo?.extra?.forestServerToken as string;

  const response = await fetch(
    `${forestServerUrl}/api/activity-logs-requests/${activityLog.attributes.index}/${activityLog.id}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Forest-Application-Source': 'MCP',
        Authorization: `Bearer ${forestServerToken}`,
      },
      body: JSON.stringify({
        data: {
          id: activityLog.id,
          type: 'activity-logs-requests',
          attributes: {
            status,
            ...(errorMessage && { errorMessage }),
          },
        },
      }),
    },
  );

  if (!response.ok) {
    const responseText = await response.text();
    logger('Error', `Failed to update activity log status to '${status}': ${responseText}`);
  }
}

interface MarkActivityLogAsFailedOptions {
  forestServerUrl: string;
  request: RequestHandlerExtra<ServerRequest, ServerNotification>;
  activityLog: ActivityLogResponse;
  errorMessage: string;
  logger: Logger;
}

export function markActivityLogAsFailed(options: MarkActivityLogAsFailedOptions): void {
  const { forestServerUrl, request, activityLog, errorMessage, logger } = options;
  // Fire-and-forget: don't block error response on activity log update
  updateActivityLogStatus({
    forestServerUrl,
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
  forestServerUrl: string;
  request: RequestHandlerExtra<ServerRequest, ServerNotification>;
  activityLog: ActivityLogResponse;
  logger: Logger;
}

export function markActivityLogAsSucceeded(options: MarkActivityLogAsSucceededOptions): void {
  const { forestServerUrl, request, activityLog, logger } = options;
  // Fire-and-forget: don't block successful response on activity log update
  updateActivityLogStatus({
    forestServerUrl,
    request,
    activityLog,
    status: 'succeeded',
    logger,
  }).catch(error => {
    logger('Error', `Unexpected error updating activity log to 'succeeded': ${error}`);
  });
}
