import type { ForestServerClient } from './types';

import {
  ActivityLogsService,
  ForestHttpApi,
  SchemaService,
  WorkflowsService,
} from '@forestadmin/forestadmin-client';

import ForestServerClientImpl from './mcp-http-client';

export interface CreateForestServerClientOptions {
  forestServerUrl: string;
  envSecret?: string;
}

export function createForestServerClient(
  options: CreateForestServerClientOptions,
): ForestServerClient {
  if (!options.envSecret) {
    throw new Error('envSecret is required to create ForestServerClient');
  }

  const forestHttpApi = new ForestHttpApi();
  const serviceOptions = {
    forestServerUrl: options.forestServerUrl,
    envSecret: options.envSecret,
  };

  const schemaService = new SchemaService(forestHttpApi, serviceOptions);
  const activityLogsService = new ActivityLogsService(forestHttpApi, {
    ...serviceOptions,
    headers: { 'Forest-Application-Source': 'MCP' },
  });
  const workflowsService = new WorkflowsService(forestHttpApi, {
    forestServerUrl: options.forestServerUrl,
    headers: { 'Forest-Application-Source': 'MCP' },
  });

  return new ForestServerClientImpl(
    schemaService,
    activityLogsService,
    workflowsService,
    options.forestServerUrl,
  );
}

export { ForestServerClientImpl };
export type {
  ActivityLogAction,
  ActivityLogResponse,
  ActivityLogsServiceInterface,
  ActivityLogType,
  CreateActivityLogParams,
  ForestServerClient,
  ListMcpWorkflowsParams,
  McpWorkflow,
  UpdateActivityLogStatusParams,
  ForestSchemaCollection,
  ForestSchemaField,
  ForestSchemaAction,
  SchemaServiceInterface,
  WorkflowsServiceInterface,
} from './types';
