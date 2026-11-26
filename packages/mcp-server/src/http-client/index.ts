import type { ForestServerClient } from './types';

import { ForestHttpApi, SchemaService, WorkflowsService } from '@forestadmin/forestadmin-client';

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
  const workflowsService = new WorkflowsService(forestHttpApi, {
    forestServerUrl: options.forestServerUrl,
    headers: { 'Forest-Application-Source': 'MCP' },
  });

  return new ForestServerClientImpl(schemaService, workflowsService, options.forestServerUrl);
}

export { ForestServerClientImpl };
export type {
  ForestServerClient,
  GetMcpWorkflowByIdParams,
  GetMcpWorkflowRunParams,
  ListMcpWorkflowsParams,
  McpWorkflow,
  McpWorkflowLookup,
  TriggerMcpWorkflowParams,
  HydratedWorkflowRun,
  WorkflowRunTriggerResult,
  ForestSchemaCollection,
  ForestSchemaField,
  ForestSchemaAction,
  SchemaServiceInterface,
  WorkflowsServiceInterface,
  SemanticLayerCollection,
  SemanticLayerDescription,
} from './types';
