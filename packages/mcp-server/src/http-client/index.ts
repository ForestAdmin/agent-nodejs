import type { ForestServerClient } from './types';

import { ActivityLogsService, SchemaService } from '@forestadmin/forestadmin-client';

import ForestServerClientImpl from './mcp-http-client';

export interface CreateForestServerClientOptions {
  forestServerUrl: string;
  envSecret?: string;
}

export function createForestServerClient(
  options: CreateForestServerClientOptions,
): ForestServerClient {
  const schemaService = new SchemaService({
    forestServerUrl: options.forestServerUrl,
    envSecret: options.envSecret || '',
  });
  const activityLogsService = new ActivityLogsService({
    forestServerUrl: options.forestServerUrl,
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
