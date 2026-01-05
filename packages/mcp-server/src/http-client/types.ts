// Re-export types from forestadmin-client for convenience
export type {
  ForestSchemaCollection,
  ForestSchemaField,
  ForestSchemaAction,
  ActivityLogResponse,
  ActivityLogAction,
  ActivityLogType,
  CreateActivityLogParams,
  UpdateActivityLogStatusParams,
  ForestAdminServerInterface,
} from '@forestadmin/forestadmin-client';

export type { HttpOptions } from '@forestadmin/forestadmin-client';

/**
 * Interface for HTTP calls made by the MCP server.
 * This abstraction allows for easy mocking in tests.
 */
export interface McpHttpClient {
  /**
   * Fetches the Forest Admin schema from the server.
   */
  fetchSchema(): Promise<import('@forestadmin/forestadmin-client').ForestSchemaCollection[]>;

  /**
   * Creates a pending activity log.
   */
  createActivityLog(
    params: import('@forestadmin/forestadmin-client').CreateActivityLogParams,
  ): Promise<import('@forestadmin/forestadmin-client').ActivityLogResponse>;

  /**
   * Updates an activity log status.
   */
  updateActivityLogStatus(
    params: import('@forestadmin/forestadmin-client').UpdateActivityLogStatusParams,
  ): Promise<Response>;
}
