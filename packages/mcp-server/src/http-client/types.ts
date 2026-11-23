import type {
  ForestSchemaAction,
  ForestSchemaCollection,
  ForestSchemaField,
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
} from '@forestadmin/forestadmin-client';

// Re-export types from forestadmin-client for convenience
export type {
  ForestSchemaAction,
  ForestSchemaCollection,
  ForestSchemaField,
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
};

/**
 * Interface for communicating with Forest Admin server.
 * This abstraction allows for easy mocking in tests.
 */
export interface ForestServerClient {
  /**
   * Base URL of the Forest Admin server this client talks to.
   */
  readonly forestServerUrl: string;

  /**
   * Fetches the Forest Admin schema from the server.
   */
  fetchSchema(): Promise<ForestSchemaCollection[]>;

  /**
   * Lists the MCP-enabled workflows the caller can access in a rendering.
   */
  listMcpEnabledWorkflows(params: ListMcpWorkflowsParams): Promise<McpWorkflow[]>;

  /**
   * Resolves a single workflow by id (name, collection, mcpEnabled), scoped to the caller.
   */
  getMcpWorkflowById(params: GetMcpWorkflowByIdParams): Promise<McpWorkflowLookup>;

  /**
   * Starts a run of an MCP-enabled workflow on a record and returns its runId (async).
   */
  triggerMcpWorkflow(params: TriggerMcpWorkflowParams): Promise<WorkflowRunTriggerResult>;

  /**
   * Reads the full hydrated workflow run, scoped to the caller.
   */
  getMcpWorkflowRun(params: GetMcpWorkflowRunParams): Promise<HydratedWorkflowRun>;
}
