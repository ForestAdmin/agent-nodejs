import type { EnvironmentPermissionsV4, RenderingPermissionV4, UserPermissionV4 } from './types';
import type { ToolConfig } from '../mcp-server-config/types';
import type { ModelCustomization } from '../model-customizations/types';
import type {
  ActivityLogHttpOptions,
  ActivityLogResponse,
  ForestAdminAuthServiceInterface,
  ForestAdminClientOptions,
  ForestAdminServerInterface,
  ForestSchemaCollection,
  HydratedWorkflowRun,
  IpWhitelistRulesResponse,
  McpWorkflow,
  McpWorkflowLookup,
  WorkflowRunTriggerResult,
} from '../types';
import type { HttpOptions } from '../utils/http-options';

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
      path: `/api/workflow-orchestrator/mcp-workflows${query}`,
      bearerToken: options.bearerToken,
      headers: { 'forest-rendering-id': renderingId, ...options.headers },
    });
  }

  async getMcpWorkflowById(
    options: ActivityLogHttpOptions,
    renderingId: string,
    workflowId: string,
  ): Promise<McpWorkflowLookup> {
    return ServerUtils.queryWithBearerToken<McpWorkflowLookup>({
      forestServerUrl: options.forestServerUrl,
      method: 'get',
      path: `/api/workflow-orchestrator/mcp-workflows/${encodeURIComponent(workflowId)}`,
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
    // The orchestrator returns a numeric runId; normalize it to the string form expected by
    // getMcpWorkflowRun. workflowName/collectionName are passed through when present so the
    // caller can label the audit log without listing every workflow first.
    const result = await ServerUtils.queryWithBearerToken<
      Omit<WorkflowRunTriggerResult, 'runId'> & { runId: number | string }
    >({
      forestServerUrl: options.forestServerUrl,
      method: 'post',
      path: `/api/workflow-orchestrator/mcp-workflows/${encodeURIComponent(workflowId)}/start`,
      bearerToken: options.bearerToken,
      body: { recordId },
      headers: { 'forest-rendering-id': renderingId, ...options.headers },
    });

    return { ...result, runId: String(result.runId) };
  }

  async getMcpWorkflowRun(
    options: ActivityLogHttpOptions,
    renderingId: string,
    runId: string,
  ): Promise<HydratedWorkflowRun> {
    return ServerUtils.queryWithBearerToken<HydratedWorkflowRun>({
      forestServerUrl: options.forestServerUrl,
      method: 'get',
      path: `/api/workflow-orchestrator/mcp-workflows/runs/${encodeURIComponent(runId)}`,
      bearerToken: options.bearerToken,
      headers: { 'forest-rendering-id': renderingId, ...options.headers },
    });
  }
}
