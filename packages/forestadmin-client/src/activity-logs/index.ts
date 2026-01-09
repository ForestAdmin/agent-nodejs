import type { HttpOptions } from '../permissions/forest-http-api';
import type {
  ActivityLogResponse,
  CreateActivityLogParams,
  ForestAdminServerInterface,
  UpdateActivityLogStatusParams,
} from '../types';

export type ActivityLogsOptions = {
  envSecret: string;
  forestServerUrl: string;
  headers?: Record<string, string>;
};

export default class ActivityLogsService {
  constructor(
    private forestAdminServerInterface: ForestAdminServerInterface,
    private options: ActivityLogsOptions,
  ) {}

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

    const body = {
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
    };

    return this.forestAdminServerInterface.createActivityLog(
      this.getHttpOptions(),
      forestServerToken,
      body,
      this.options.headers,
    );
  }

  async updateActivityLogStatus(params: UpdateActivityLogStatusParams): Promise<void> {
    const { forestServerToken, activityLog, status, errorMessage } = params;

    const body = {
      status,
      ...(errorMessage && { errorMessage }),
    };

    await this.forestAdminServerInterface.updateActivityLogStatus(
      this.getHttpOptions(),
      forestServerToken,
      activityLog.attributes.index,
      activityLog.id,
      body,
      this.options.headers,
    );
  }

  private getHttpOptions(): HttpOptions {
    return {
      envSecret: this.options.envSecret,
      forestServerUrl: this.options.forestServerUrl,
    };
  }
}
