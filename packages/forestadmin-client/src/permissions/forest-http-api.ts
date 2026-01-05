import type { EnvironmentPermissionsV4, RenderingPermissionV4, UserPermissionV4 } from './types';
import type { ModelCustomization } from '../model-customizations/types';
import type {
  ActivityLogResponse,
  CreateActivityLogParams,
  ForestAdminAuthServiceInterface,
  ForestAdminClientOptions,
  ForestAdminClientOptionsWithDefaults,
  ForestAdminServerInterface,
  ForestSchemaCollection,
  UpdateActivityLogStatusParams,
} from '../types';
import type { McpConfiguration } from '@forestadmin/ai-proxy';

import JSONAPISerializer from 'json-api-serializer';

import AuthService from '../auth';
import ServerUtils from '../utils/server';

export type HttpOptions = Pick<
  ForestAdminClientOptionsWithDefaults,
  'envSecret' | 'forestServerUrl'
>;

export default class ForestHttpApi implements ForestAdminServerInterface {
  async getEnvironmentPermissions(options: HttpOptions): Promise<EnvironmentPermissionsV4> {
    return ServerUtils.query(options, 'get', '/liana/v4/permissions/environment');
  }

  async getUsers(options: HttpOptions): Promise<UserPermissionV4[]> {
    return ServerUtils.query(options, 'get', '/liana/v4/permissions/users');
  }

  async getRenderingPermissions(
    renderingId: number,
    options: HttpOptions,
  ): Promise<RenderingPermissionV4> {
    return ServerUtils.query(options, 'get', `/liana/v4/permissions/renderings/${renderingId}`);
  }

  async getModelCustomizations(options: HttpOptions): Promise<ModelCustomization[]> {
    return ServerUtils.query<ModelCustomization[]>(options, 'get', '/liana/model-customizations');
  }

  async getMcpServerConfigs(options: HttpOptions): Promise<McpConfiguration> {
    return ServerUtils.query<McpConfiguration>(
      options,
      'get',
      '/liana/mcp-server-configs-with-details',
    );
  }

  makeAuthService(options: Required<ForestAdminClientOptions>): ForestAdminAuthServiceInterface {
    return new AuthService(options);
  }

  async getSchema(options: HttpOptions): Promise<ForestSchemaCollection[]> {
    const response = await ServerUtils.query<{
      data: Array<{ id: string; type: string; attributes: Record<string, unknown> }>;
      included?: Array<{ id: string; type: string; attributes: Record<string, unknown> }>;
    }>(options, 'get', '/liana/forest-schema');

    const serializer = new JSONAPISerializer();
    serializer.register('collections', {
      relationships: {
        fields: { type: 'fields' },
        actions: { type: 'actions' },
        segments: { type: 'segments' },
      },
    });
    serializer.register('fields', {});
    serializer.register('actions', {});
    serializer.register('segments', {});

    return serializer.deserialize('collections', response) as ForestSchemaCollection[];
  }

  async createActivityLog(
    options: HttpOptions,
    params: CreateActivityLogParams,
  ): Promise<ActivityLogResponse> {
    const { forestServerToken, renderingId, action, type, collectionName, recordId, recordIds, label } =
      params;

    const response = await fetch(`${options.forestServerUrl}/api/activity-logs-requests`, {
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

  async updateActivityLogStatus(
    options: HttpOptions,
    params: UpdateActivityLogStatusParams,
  ): Promise<Response> {
    const { forestServerToken, activityLog, status, errorMessage } = params;

    return fetch(
      `${options.forestServerUrl}/api/activity-logs-requests/${activityLog.attributes.index}/${activityLog.id}/status`,
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
