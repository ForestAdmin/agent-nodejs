import type { EnvironmentPermissionsV4, RenderingPermissionV4, UserPermissionV4 } from './types';
import type { ModelCustomization } from '../model-customizations/types';
import type {
  ActivityLogHttpOptions,
  ActivityLogResponse,
  ForestAdminAuthServiceInterface,
  ForestAdminClientOptions,
  ForestAdminServerInterface,
  ForestSchemaCollection,
  IpWhitelistRulesResponse,
  McpWorkflow,
  WorkflowRunTriggerResult,
} from '../types';
import type { HttpOptions } from '../utils/http-options';
import type { ToolConfig } from '@forestadmin/ai-proxy';

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

  async getMcpServerConfigs(options: HttpOptions): Promise<Record<string, ToolConfig>> {
    return ServerUtils.query<Record<string, ToolConfig>>(
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
    const schemaPublicationTimeout = 30_000;
    await ServerUtils.query(
      options,
      'post',
      '/forest/apimaps',
      {},
      schema,
      schemaPublicationTimeout,
    );
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
    options: ActivityLogHttpOptions,
    body: object,
  ): Promise<ActivityLogResponse> {
    const { data: activityLog } = await ServerUtils.queryWithBearerToken<{
      data: ActivityLogResponse;
    }>({
      forestServerUrl: options.forestServerUrl,
      method: 'post',
      path: '/api/activity-logs-requests',
      bearerToken: options.bearerToken,
      body,
      headers: options.headers,
    });

    return activityLog;
  }

  async createMcpActivityLog(
    options: ActivityLogHttpOptions,
    body: object,
  ): Promise<ActivityLogResponse> {
    const { data: activityLog } = await ServerUtils.queryWithBearerToken<{
      data: ActivityLogResponse;
    }>({
      forestServerUrl: options.forestServerUrl,
      method: 'post',
      path: '/api/activity-logs-requests/mcp',
      bearerToken: options.bearerToken,
      body,
      headers: options.headers,
    });

    return activityLog;
  }

  async updateActivityLogStatus(
    options: ActivityLogHttpOptions,
    index: string,
    id: string,
    body: object,
  ): Promise<void> {
    await ServerUtils.queryWithBearerToken({
      forestServerUrl: options.forestServerUrl,
      method: 'patch',
      path: `/api/activity-logs-requests/${index}/${id}/status`,
      bearerToken: options.bearerToken,
      body,
      headers: options.headers,
    });
  }

  async listMcpEnabledWorkflows(
    options: ActivityLogHttpOptions,
    renderingId: string,
    collectionName?: string,
  ): Promise<McpWorkflow[]> {
    const query = collectionName ? `?collectionName=${encodeURIComponent(collectionName)}` : '';

    return ServerUtils.queryWithBearerToken<McpWorkflow[]>({
      forestServerUrl: options.forestServerUrl,
      method: 'get',
      path: `/api/workflow-orchestrator/workflows${query}`,
      bearerToken: options.bearerToken,
      headers: { 'forest-rendering-id': renderingId, ...options.headers },
    });
  }

  async triggerMcpWorkflow(
    options: ActivityLogHttpOptions,
    renderingId: string,
    workflowId: string,
    recordId: string,
  ): Promise<WorkflowRunTriggerResult> {
    return ServerUtils.queryWithBearerToken<WorkflowRunTriggerResult>({
      forestServerUrl: options.forestServerUrl,
      method: 'post',
      path: `/api/workflow-orchestrator/workflows/${encodeURIComponent(workflowId)}/start`,
      bearerToken: options.bearerToken,
      body: { recordId },
      headers: { 'forest-rendering-id': renderingId, ...options.headers },
    });
  }
}
