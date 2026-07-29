import type {
  ForestAdminServerInterface,
  GetMcpWorkflowRunParams,
  ListMcpWorkflowsParams,
  McpWorkflow,
  TriggerMcpWorkflowParams,
  WorkflowRunStatus,
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

    if (!this.forestAdminServerInterface.listMcpEnabledWorkflows) {
      throw new Error(
        'The configured Forest server transport does not support listMcpEnabledWorkflows.',
      );
    }

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

    if (!this.forestAdminServerInterface.triggerMcpWorkflow) {
      throw new Error(
        'The configured Forest server transport does not support triggerMcpWorkflow.',
      );
    }

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

  async getMcpWorkflowRun(params: GetMcpWorkflowRunParams): Promise<WorkflowRunStatus> {
    const { forestServerToken, renderingId, runId } = params;

    if (!this.forestAdminServerInterface.getMcpWorkflowRun) {
      throw new Error('The configured Forest server transport does not support getMcpWorkflowRun.');
    }

    return this.forestAdminServerInterface.getMcpWorkflowRun(
      {
        forestServerUrl: this.options.forestServerUrl,
        bearerToken: forestServerToken,
        headers: this.options.headers,
      },
      renderingId,
      runId,
    );
  }
}
