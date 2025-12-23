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
  | 'delete';

const ACTION_TO_TYPE: Record<ActivityLogAction, 'read' | 'write'> = {
  index: 'read',
  search: 'read',
  filter: 'read',
  action: 'write',
  create: 'write',
  update: 'write',
  delete: 'write',
};

export default async function createActivityLog(
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
      // 'forest-secret-key': process.env.FOREST_ENV_SECRET || '',
    },
    body: JSON.stringify({
      data: {
        id: 1,
        type: 'activity-logs-requests',
        attributes: {
          type,
          action,
          label: extra?.label,
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
}
