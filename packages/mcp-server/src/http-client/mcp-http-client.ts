import type {
  ActivityLogResponse,
  CreateActivityLogParams,
  McpHttpClient,
  UpdateActivityLogStatusParams,
} from './types';
import type { ForestCollection } from '../utils/schema-fetcher';

import JsonApiSerializer from 'jsonapi-serializer';

interface JSONAPIItem {
  id: string;
  type: string;
  attributes: Record<string, unknown>;
  relationships: Record<string, { data: { id: string; type: string } }>;
}

export default class McpHttpClientImpl implements McpHttpClient {
  constructor(private readonly forestServerUrl: string, private readonly envSecret: string) {}

  async fetchSchema(): Promise<ForestCollection[]> {
    const response = await fetch(`${this.forestServerUrl}/liana/forest-schema`, {
      method: 'GET',
      headers: {
        'forest-secret-key': this.envSecret,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch forest schema: ${errorText}`);
    }

    const schema = (await response.json()) as {
      data: JSONAPIItem[];
      included?: JSONAPIItem[];
      meta: { liana: string; liana_version: string; liana_features: string[] | null };
    };
    const serializer = new JsonApiSerializer.Deserializer({
      keyForAttribute: 'camelCase',
    });

    return serializer.deserialize(schema) as Promise<ForestCollection[]>;
  }

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

    const response = await fetch(`${this.forestServerUrl}/api/activity-logs-requests`, {
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
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create activity log: ${await response.text()}`);
    }

    const { data: activityLog } = (await response.json()) as { data: ActivityLogResponse };

    return activityLog;
  }

  async updateActivityLogStatus(params: UpdateActivityLogStatusParams): Promise<Response> {
    const { forestServerToken, activityLog, status, errorMessage } = params;

    return fetch(
      `${this.forestServerUrl}/api/activity-logs-requests/${activityLog.attributes.index}/${activityLog.id}/status`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Forest-Application-Source': 'MCP',
          Authorization: `Bearer ${forestServerToken}`,
        },
        body: JSON.stringify({
          status,
          ...(errorMessage && { errorMessage }),
        }),
      },
    );
  }
}
