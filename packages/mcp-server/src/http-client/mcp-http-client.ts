import type {
  ForestSchemaCollection,
  ForestServerClient,
  GetMcpWorkflowByIdParams,
  GetMcpWorkflowRunParams,
  HydratedWorkflowRun,
  ListMcpWorkflowsParams,
  McpWorkflow,
  McpWorkflowLookup,
  SchemaServiceInterface,
  TriggerMcpWorkflowParams,
  WorkflowRunTriggerResult,
  WorkflowsServiceInterface,
} from './types';

/**
 * Default implementation of ForestServerClient that uses SchemaService and WorkflowsService.
 * This provides a convenient API for MCP server operations.
 */
export default class ForestServerClientImpl implements ForestServerClient {
  constructor(
    private readonly schemaService: SchemaServiceInterface,
    private readonly workflowsService: WorkflowsServiceInterface,
    public readonly forestServerUrl: string,
  ) {}

  async fetchSchema(): Promise<ForestSchemaCollection[]> {
    return this.schemaService.getSchema();
  }

  async listMcpEnabledWorkflows(params: ListMcpWorkflowsParams): Promise<McpWorkflow[]> {
    return this.workflowsService.listMcpEnabledWorkflows(params);
  }

  async getMcpWorkflowById(params: GetMcpWorkflowByIdParams): Promise<McpWorkflowLookup> {
    return this.workflowsService.getMcpWorkflowById(params);
  }

  async triggerMcpWorkflow(params: TriggerMcpWorkflowParams): Promise<WorkflowRunTriggerResult> {
    return this.workflowsService.triggerMcpWorkflow(params);
  }

  async getMcpWorkflowRun(params: GetMcpWorkflowRunParams): Promise<HydratedWorkflowRun> {
    return this.workflowsService.getMcpWorkflowRun(params);
  }
}
