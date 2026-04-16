import type { ForestServerClient } from './types';

import { ActivityLogsService, ForestHttpApi, SchemaService } from '@forestadmin/forestadmin-client';

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

  return new ForestServerClientImpl(schemaService, activityLogsService);
}

export { ForestServerClientImpl };
export type {
  ActivityLogAction,
  ActivityLogResponse,
  ActivityLogsServiceInterface,
  ActivityLogType,
  CreateActivityLogParams,
  ForestServerClient,
  UpdateActivityLogStatusParams,
  ForestSchemaCollection,
  ForestSchemaField,
  ForestSchemaAction,
  SchemaServiceInterface,
} from './types';
