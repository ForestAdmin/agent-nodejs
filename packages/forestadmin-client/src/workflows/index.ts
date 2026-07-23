import type {
  ForestAdminServerInterface,
  ListMcpWorkflowsParams,
  McpWorkflow,
  TriggerMcpWorkflowParams,
  WorkflowRunTriggerResult,
} from '../types';

export type WorkflowsServiceOptions = {
  forestServerUrl: string;
  headers?: Record<string, string>;
};

export default class WorkflowsService {
  constructor(
    private forestAdminServerInterface: ForestAdminServerInterface,
    private options: WorkflowsServiceOptions,
  ) {}

  async listMcpEnabledWorkflows(params: ListMcpWorkflowsParams): Promise<McpWorkflow[]> {
    const { forestServerToken, renderingId, collectionName } = params;

    return this.forestAdminServerInterface.listMcpEnabledWorkflows(
      {
        forestServerUrl: this.options.forestServerUrl,
        bearerToken: forestServerToken,
        headers: this.options.headers,
      },
      renderingId,
      collectionName,
    );
  }

  async triggerMcpWorkflow(params: TriggerMcpWorkflowParams): Promise<WorkflowRunTriggerResult> {
    const { forestServerToken, renderingId, workflowId, recordId } = params;

    return this.forestAdminServerInterface.triggerMcpWorkflow(
      {
        forestServerUrl: this.options.forestServerUrl,
        bearerToken: forestServerToken,
        headers: this.options.headers,
      },
      renderingId,
      workflowId,
      recordId,
    );
  }
}
