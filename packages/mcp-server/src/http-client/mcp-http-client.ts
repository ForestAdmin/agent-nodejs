import type {
  ActivityLogResponse,
  ActivityLogsServiceInterface,
  CreateActivityLogParams,
  ForestSchemaCollection,
  ForestServerClient,
  SchemaServiceInterface,
  UpdateActivityLogStatusParams,
} from './types';
import type { ForestAdminServerInterface } from '@forestadmin/forestadmin-client';

/**
 * Default implementation of ForestServerClient that uses SchemaService and ActivityLogsService.
 * This provides a convenient API for MCP server operations.
 */
export default class ForestServerClientImpl implements ForestServerClient {
  constructor(
    private readonly schemaService: SchemaServiceInterface,
    private readonly activityLogsService: ActivityLogsServiceInterface,
    private readonly forestHttpApi: ForestAdminServerInterface,
    private readonly forestServerUrl: string,
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

  async getCollectionId(
    renderingId: string,
    collectionName: string,
    bearerToken: string,
  ): Promise<string | null> {
    if (!this.forestHttpApi.getCollectionId) {
      return null;
    }

    return this.forestHttpApi.getCollectionId(
      { forestServerUrl: this.forestServerUrl, bearerToken },
      renderingId,
      collectionName,
    );
  }
}
