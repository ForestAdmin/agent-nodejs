import type { ForestAdminServerInterface, ListMcpWorkflowsParams, McpWorkflow } from '../types';

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
}
