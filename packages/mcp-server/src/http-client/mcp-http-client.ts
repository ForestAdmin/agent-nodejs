import type {
  ActivityLogResponse,
  ActivityLogsServiceInterface,
  CreateActivityLogParams,
  ForestSchemaCollection,
  ForestServerClient,
  SchemaServiceInterface,
  UpdateActivityLogStatusParams,
} from './types';

/**
 * Default implementation of ForestServerClient that uses SchemaService and ActivityLogsService.
 * This provides a convenient API for MCP server operations.
 */
export default class ForestServerClientImpl implements ForestServerClient {
  constructor(
    private readonly schemaService: SchemaServiceInterface,
    private readonly activityLogsService: ActivityLogsServiceInterface,
  ) {}

  async fetchSchema(): Promise<ForestSchemaCollection[]> {
    return this.schemaService.getSchema();
  }

  async createActivityLog(params: CreateActivityLogParams): Promise<ActivityLogResponse> {
    return this.activityLogsService.createActivityLog(params);
  }

  async updateActivityLogStatus(params: UpdateActivityLogStatusParams): Promise<void> {
    return this.activityLogsService.updateActivityLogStatus(params);
  }
}
