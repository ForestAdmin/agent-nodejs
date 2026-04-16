import type {
  ActivityLogHttpOptions,
  ActivityLogResponse,
  CreateActivityLogParams,
  ForestAdminServerInterface,
  UpdateActivityLogStatusParams,
} from '../types';

import { NotFoundError } from '../auth/errors';
import ServerUtils from '../utils/server';

export type ActivityLogsOptions = {
  forestServerUrl: string;
  headers?: Record<string, string>;
};

export default class ActivityLogsService {
  // Cache: renderingId → (collectionName → collectionId)
  private collectionIdCache = new Map<string, Map<string, string>>();

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

    const collectionId = collectionName
      ? await this.resolveCollectionId(renderingId, collectionName, forestServerToken)
      : null;

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
            data: (collectionId || collectionName)
              ? {
                  id: collectionId || collectionName,
                  type: 'collections',
                }
              : null,
          },
        },
      },
    };

    return this.forestAdminServerInterface.createActivityLog(
      this.getHttpOptions(forestServerToken),
      body,
    );
  }

  async updateActivityLogStatus(params: UpdateActivityLogStatusParams): Promise<void> {
    const { forestServerToken, activityLog, status, errorMessage } = params;

    const body = {
      status,
      ...(errorMessage && { errorMessage }),
    };

    await this.forestAdminServerInterface.updateActivityLogStatus(
      this.getHttpOptions(forestServerToken),
      activityLog.attributes.index,
      activityLog.id,
      body,
    );
  }

  private async resolveCollectionId(
    renderingId: string,
    collectionName: string,
    bearerToken: string,
  ): Promise<string | null> {
    const renderingCache = this.collectionIdCache.get(renderingId);

    if (renderingCache?.has(collectionName)) {
      return renderingCache.get(collectionName)!;
    }

    try {
      const { collectionId } = await ServerUtils.queryWithBearerToken<{ collectionId: string }>({
        forestServerUrl: this.options.forestServerUrl,
        method: 'get',
        path: `/api/renderings/${renderingId}/collections/${encodeURIComponent(collectionName)}/id`,
        bearerToken,
        headers: this.options.headers,
      });

      if (collectionId) {
        if (!this.collectionIdCache.has(renderingId)) {
          this.collectionIdCache.set(renderingId, new Map());
        }

        this.collectionIdCache.get(renderingId)!.set(collectionName, collectionId);
      }

      return collectionId;
    } catch (error) {
      // Fallback to collectionName if endpoint doesn't exist (server not yet updated)
      if (error instanceof NotFoundError) {
        return null;
      }

      throw error;
    }
  }

  private getHttpOptions(bearerToken: string): ActivityLogHttpOptions {
    return {
      forestServerUrl: this.options.forestServerUrl,
      bearerToken,
      headers: this.options.headers,
    };
  }
}
