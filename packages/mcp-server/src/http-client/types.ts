import type {
  ActivityLogAction,
  ActivityLogResponse,
  ActivityLogType,
  CreateActivityLogParams,
  ForestAdminServerInterface,
  ForestSchemaAction,
  ForestSchemaCollection,
  ForestSchemaField,
  HttpOptions,
  UpdateActivityLogStatusParams,
} from '@forestadmin/forestadmin-client';

// Re-export types from forestadmin-client for convenience
export type {
  ActivityLogAction,
  ActivityLogResponse,
  ActivityLogType,
  CreateActivityLogParams,
  ForestAdminServerInterface,
  ForestSchemaAction,
  ForestSchemaCollection,
  ForestSchemaField,
  HttpOptions,
  UpdateActivityLogStatusParams,
};

/**
 * Interface for HTTP calls made by the MCP server.
 * This abstraction allows for easy mocking in tests.
 */
export interface McpHttpClient {
  /**
   * Fetches the Forest Admin schema from the server.
   */
  fetchSchema(): Promise<ForestSchemaCollection[]>;

  /**
   * Creates a pending activity log.
   */
  createActivityLog(params: CreateActivityLogParams): Promise<ActivityLogResponse>;

  /**
   * Updates an activity log status.
   */
  updateActivityLogStatus(params: UpdateActivityLogStatusParams): Promise<Response>;
}
