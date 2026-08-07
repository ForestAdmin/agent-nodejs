import type {
  ActivityLogResponse,
  ActivityLogsServiceInterface,
  CreateActivityLogParams,
  ForestSchemaCollection,
  ForestServerClient,
  GetMcpWorkflowRunParams,
  ListMcpWorkflowsParams,
  McpWorkflow,
  SchemaServiceInterface,
  TriggerMcpWorkflowParams,
  UpdateActivityLogStatusParams,
  WorkflowRunStatus,
  WorkflowRunTriggerResult,
  WorkflowsServiceInterface,
} from './types';

/**
 * Default implementation of ForestServerClient that uses SchemaService, ActivityLogsService
 * and WorkflowsService. This provides a convenient API for MCP server operations.
 */
export default class ForestServerClientImpl implements ForestServerClient {
  constructor(
    private readonly schemaService: SchemaServiceInterface,
    private readonly activityLogsService: ActivityLogsServiceInterface,
    private readonly workflowsService: WorkflowsServiceInterface,
    public readonly forestServerUrl: string,
  ) {}

  async fetchSchema(): Promise<ForestSchemaCollection[]> {
    return this.schemaService.getSchema();
  }

  async createActivityLog(params: CreateActivityLogParams): Promise<ActivityLogResponse> {
    return this.activityLogsService.createActivityLog(params);
  }

  async createMcpActivityLog(params: CreateActivityLogParams): Promise<ActivityLogResponse> {
    return this.activityLogsService.createMcpActivityLog(params);
  }

  async updateActivityLogStatus(params: UpdateActivityLogStatusParams): Promise<void> {
    return this.activityLogsService.updateActivityLogStatus(params);
  }

  async listMcpWorkflows(params: ListMcpWorkflowsParams): Promise<McpWorkflow[]> {
    return this.workflowsService.listMcpEnabledWorkflows(params);
  }

  async triggerWorkflow(params: TriggerMcpWorkflowParams): Promise<WorkflowRunTriggerResult> {
    return this.workflowsService.triggerMcpWorkflow(params);
  }

  async getWorkflowRun(params: GetMcpWorkflowRunParams): Promise<WorkflowRunStatus> {
    return this.workflowsService.getMcpWorkflowRun(params);
  }
}
