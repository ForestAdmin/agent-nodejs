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
    }>({
      forestServerUrl: this.options.forestServerUrl,
      method: 'post',
      path: '/api/activity-logs-requests',
      bearerToken: forestServerToken,
      headers: MCP_HEADERS,
      body: {
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
      },
    });

    return activityLog;
  }

  async updateActivityLogStatus(params: UpdateActivityLogStatusParams): Promise<void> {
    const { forestServerToken, activityLog, status, errorMessage } = params;

    await ServerUtils.queryWithBearerToken({
      forestServerUrl: this.options.forestServerUrl,
      method: 'patch',
      path: `/api/activity-logs-requests/${activityLog.attributes.index}/${activityLog.id}/status`,
      bearerToken: forestServerToken,
      headers: MCP_HEADERS,
      body: {
        status,
        ...(errorMessage && { errorMessage }),
      },
    });
  }
}
