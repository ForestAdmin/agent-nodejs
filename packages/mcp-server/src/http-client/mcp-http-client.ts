import type {
  ActivityLogResponse,
  CreateActivityLogParams,
  ForestAdminServerInterface,
  ForestSchemaCollection,
  HttpOptions,
  McpHttpClient,
  UpdateActivityLogStatusParams,
} from './types';

/**
 * Default implementation of McpHttpClient that wraps ForestAdminServerInterface.
 * This provides a convenient API that doesn't require passing HttpOptions on each call.
 */
export default class McpHttpClientImpl implements McpHttpClient {
  private readonly httpOptions: HttpOptions;

  constructor(
    private readonly serverInterface: ForestAdminServerInterface,
    forestServerUrl: string,
    envSecret: string,
  ) {
    this.httpOptions = { forestServerUrl, envSecret };
  }

  async fetchSchema(): Promise<ForestSchemaCollection[]> {
    return this.serverInterface.getSchema(this.httpOptions);
  }

  async createActivityLog(params: CreateActivityLogParams): Promise<ActivityLogResponse> {
    return this.serverInterface.createActivityLog(this.httpOptions, params);
  }

  async updateActivityLogStatus(params: UpdateActivityLogStatusParams): Promise<Response> {
    return this.serverInterface.updateActivityLogStatus(this.httpOptions, params);
  }
}
