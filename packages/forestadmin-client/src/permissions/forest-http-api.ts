import type { EnvironmentPermissionsV4, RenderingPermissionV4, UserPermissionV4 } from './types';
import type { ModelCustomization } from '../model-customizations/types';
import type {
  ActivityLogResponse,
  ForestAdminAuthServiceInterface,
  ForestAdminClientOptions,
  ForestAdminServerInterface,
  ForestSchemaCollection,
  IpWhitelistRulesResponse,
} from '../types';
import type { HttpOptions } from '../utils/http-options';
import type { McpConfiguration } from '@forestadmin/ai-proxy';

import JSONAPISerializer from 'json-api-serializer';

import AuthService from '../auth';
import ServerUtils from '../utils/server';

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
    serializer.register('actions', {
      relationships: {
        fields: { type: 'fields' },
      },
    });
    serializer.register('segments', {});

    return serializer.deserialize('collections', response) as ForestSchemaCollection[];
  }

  async postSchema(options: HttpOptions, schema: object): Promise<void> {
    await ServerUtils.query(options, 'post', '/forest/apimaps', {}, schema);
  }

  async checkSchemaHash(options: HttpOptions, hash: string): Promise<{ sendSchema: boolean }> {
    return ServerUtils.query<{ sendSchema: boolean }>(
      options,
      'post',
      '/forest/apimaps/hashcheck',
      {},
      { schemaFileHash: hash },
    );
  }

  async getIpWhitelistRules(options: HttpOptions): Promise<IpWhitelistRulesResponse> {
    return ServerUtils.query(options, 'get', '/liana/v1/ip-whitelist-rules');
  }

  async createActivityLog(
    forestServerUrl: string,
    bearerToken: string,
    body: object,
    headers?: Record<string, string>,
  ): Promise<ActivityLogResponse> {
    const { data: activityLog } = await ServerUtils.queryWithBearerToken<{
      data: ActivityLogResponse;
    }>({
      forestServerUrl,
      method: 'post',
      path: '/api/activity-logs-requests',
      bearerToken,
      body,
      headers,
    });

    return activityLog;
  }

  async updateActivityLogStatus(
    forestServerUrl: string,
    bearerToken: string,
    index: string,
    id: string,
    body: object,
    headers?: Record<string, string>,
  ): Promise<void> {
    await ServerUtils.queryWithBearerToken({
      forestServerUrl,
      method: 'patch',
      path: `/api/activity-logs-requests/${index}/${id}/status`,
      bearerToken,
      body,
      headers,
    });
  }
}
