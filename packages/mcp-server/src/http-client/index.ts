import type { McpHttpClient } from './types';

import { ActivityLogsService, SchemaService } from '@forestadmin/forestadmin-client';

import McpHttpClientImpl from './mcp-http-client';

export interface CreateMcpHttpClientOptions {
  forestServerUrl: string;
  envSecret?: string;
}

export function createMcpHttpClient(options: CreateMcpHttpClientOptions): McpHttpClient {
  const schemaService = new SchemaService({
    forestServerUrl: options.forestServerUrl,
    envSecret: options.envSecret || '',
  });
  const activityLogsService = new ActivityLogsService({
    forestServerUrl: options.forestServerUrl,
  });

  return new McpHttpClientImpl(schemaService, activityLogsService);
}

export { McpHttpClientImpl };
export type {
  ActivityLogAction,
  ActivityLogResponse,
  ActivityLogsServiceInterface,
  ActivityLogType,
  CreateActivityLogParams,
  McpHttpClient,
  UpdateActivityLogStatusParams,
  ForestSchemaCollection,
  ForestSchemaField,
  ForestSchemaAction,
  SchemaServiceInterface,
} from './types';
