import type {
  ActivityLogResponse,
  CreateActivityLogParams,
  UpdateActivityLogStatusParams,
} from '../types';

import ServerUtils from '../utils/server';

export type ActivityLogsOptions = {
  forestServerUrl: string;
  headers?: Record<string, string>;
};

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
      headers: this.options.headers,
      body: {
        data: {
          id: 1,
          type: 'activity-logs-requests',
          attributes: {
            type,
            action,
            label,
            status: 'pending',
            // Ensure all record IDs are converted to strings
            records: (recordIds || (recordId ? [recordId] : [])).map(String),
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
      headers: this.options.headers,
      body: {
        status,
        ...(errorMessage && { errorMessage }),
      },
    });
  }
}
