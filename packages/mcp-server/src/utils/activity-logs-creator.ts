import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';

// Mapping from internal action names to API-accepted action names
// The API only accepts specific action names like 'read', 'action', 'create', 'update', 'delete', etc.
const actionMapping: Record<string, { apiAction: string; type: 'read' | 'write' }> = {
  index: { apiAction: 'index', type: 'read' },
  search: { apiAction: 'search', type: 'read' },
  filter: { apiAction: 'filter', type: 'read' },
  listHasMany: { apiAction: 'index', type: 'read' },
  actionForm: { apiAction: 'read', type: 'read' },
  action: { apiAction: 'action', type: 'write' },
  create: { apiAction: 'create', type: 'write' },
  update: { apiAction: 'update', type: 'write' },
  delete: { apiAction: 'delete', type: 'write' },
  availableActions: { apiAction: 'read', type: 'read' },
  availableCollections: { apiAction: 'read', type: 'read' },
  // Action-related MCP tools
  getActionForm: { apiAction: 'read', type: 'read' },
  executeAction: { apiAction: 'action', type: 'write' },
};

/**
 * Creates an activity log entry in Forest Admin.
 * This function is non-blocking - failures are logged but don't prevent the main operation.
 */
export default async function createActivityLog(
  forestServerUrl: string,
  request: RequestHandlerExtra<ServerRequest, ServerNotification>,
  action: string,
  extra?: {
    collectionName?: string;
    recordId?: string | number;
    recordIds?: string[] | number[];
    label?: string;
  },
): Promise<void> {
  const mapping = actionMapping[action];

  if (!mapping) {
    // Unknown action type - log warning but don't block the operation
    console.warn(`[ActivityLog] Unknown action type: ${action} - skipping activity log`);

    return;
  }

  const { apiAction, type } = mapping;

  const forestServerToken = request.authInfo?.extra?.forestServerToken as string;
  const renderingId = request.authInfo?.extra?.renderingId as string;

  try {
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
            action: apiAction,
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
      // Log warning but don't block the main operation
      console.warn(`[ActivityLog] Failed to create activity log: ${await response.text()}`);
    }
  } catch (error) {
    // Log error but don't block the main operation
    console.warn(
      `[ActivityLog] Error creating activity log: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
