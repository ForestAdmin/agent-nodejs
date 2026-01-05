import type {
  ActivityLogResponse,
  CreateActivityLogParams,
  UpdateActivityLogStatusParams,
} from '../types';

import ServerUtils from '../utils/server';

export type ActivityLogsOptions = {
  forestServerUrl: string;
};

const MCP_HEADERS = { 'Forest-Application-Source': 'MCP' };

export default class ActivityLogsService {
  constructor(private options: ActivityLogsOptions) {}

  async createActivityLog(params: CreateActivityLogParams): Promise<ActivityLogResponse> {
    const {
      forestServerToken,
      renderingId,
      action,
      type,
      collectionName,
      recordId,
      recordIds,
      label,
    } = params;

    const { data: activityLog } = await ServerUtils.queryWithBearerToken<{
      data: ActivityLogResponse;
    }>(this.options, 'post', '/api/activity-logs-requests', forestServerToken, MCP_HEADERS, {
      data: {
        id: 1,
        type: 'activity-logs-requests',
        attributes: {
          type,
          action,
          label,
          status: 'pending',
          records: (recordIds || (recordId ? [recordId] : [])) as string[],
        },
        relationships: {
          rendering: {
            data: {
              id: renderingId,
              type: 'renderings',
            },
          },
          collection: {
            data: collectionName
              ? {
                  id: collectionName,
                  type: 'collections',
                }
              : null,
          },
        },
      },
    });

    return activityLog;
  }

  async updateActivityLogStatus(params: UpdateActivityLogStatusParams): Promise<void> {
    const { forestServerToken, activityLog, status, errorMessage } = params;

    await ServerUtils.queryWithBearerToken(
      this.options,
      'patch',
      `/api/activity-logs-requests/${activityLog.attributes.index}/${activityLog.id}/status`,
      forestServerToken,
      MCP_HEADERS,
      {
        status,
        ...(errorMessage && { errorMessage }),
      },
    );
  }
}
