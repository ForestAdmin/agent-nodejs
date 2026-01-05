import type { ForestCollection } from '../utils/schema-fetcher';

/**
 * Activity log response from the Forest Admin server.
 */
export interface ActivityLogResponse {
  id: string;
  attributes: {
    index: string;
  };
}

/**
 * Valid activity log actions.
 * These must match ActivityLogActions enum in forestadmin-server.
 */
export type ActivityLogAction =
  | 'index'
  | 'search'
  | 'filter'
  | 'action'
  | 'create'
  | 'update'
  | 'delete'
  | 'listRelatedData'
  | 'describeCollection';

export type ActivityLogType = 'read' | 'write';

export interface CreateActivityLogParams {
  forestServerToken: string;
  renderingId: string;
  action: ActivityLogAction;
  type: ActivityLogType;
  collectionName?: string;
  recordId?: string | number;
  recordIds?: string[] | number[];
  label?: string;
}

export interface UpdateActivityLogStatusParams {
  forestServerToken: string;
  activityLog: ActivityLogResponse;
  status: 'completed' | 'failed';
  errorMessage?: string;
}

/**
 * Interface for HTTP calls made by the MCP server.
 * This abstraction allows for easy mocking in tests.
 */
export interface McpHttpClient {
  /**
   * Fetches the Forest Admin schema from the server.
   */
  fetchSchema(): Promise<ForestCollection[]>;

  /**
   * Creates a pending activity log.
   */
  createActivityLog(params: CreateActivityLogParams): Promise<ActivityLogResponse>;

  /**
   * Updates an activity log status.
   */
  updateActivityLogStatus(params: UpdateActivityLogStatusParams): Promise<Response>;
}
