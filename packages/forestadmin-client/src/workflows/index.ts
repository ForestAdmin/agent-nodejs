import type {
  ForestAdminServerInterface,
  GetMcpWorkflowByIdParams,
  GetMcpWorkflowRunParams,
  HydratedWorkflowRun,
  ListMcpWorkflowsParams,
  McpWorkflow,
  McpWorkflowLookup,
  TriggerMcpWorkflowParams,
  WorkflowRunTriggerResult,
} from '../types';

export type WorkflowsServiceOptions = {
  forestServerUrl: string;
  headers?: Record<string, string>;
};

type WorkflowTransportMethod =
  | 'listMcpEnabledWorkflows'
  | 'getMcpWorkflowById'
  | 'triggerMcpWorkflow'
  | 'getMcpWorkflowRun';

export default class WorkflowsService {
  constructor(
    private forestAdminServerInterface: ForestAdminServerInterface,
    private options: WorkflowsServiceOptions,
  ) {}

  // The transport interface methods are optional so external implementations keep compiling;
  // resolve the bound method or fail with a uniform message.
  private resolveTransportMethod<K extends WorkflowTransportMethod>(
    name: K,
  ): NonNullable<ForestAdminServerInterface[K]> {
    const method = this.forestAdminServerInterface[name];

    if (!method) {
      throw new Error(`The configured Forest server transport does not support ${name}.`);
    }

    return method.bind(this.forestAdminServerInterface) as NonNullable<
      ForestAdminServerInterface[K]
    >;
  }

  private httpOptions(forestServerToken: string) {
    return {
      forestServerUrl: this.options.forestServerUrl,
      bearerToken: forestServerToken,
      headers: this.options.headers,
    };
  }

  async listMcpEnabledWorkflows(params: ListMcpWorkflowsParams): Promise<McpWorkflow[]> {
    const { forestServerToken, renderingId, collectionName } = params;

    return this.resolveTransportMethod('listMcpEnabledWorkflows')(
      this.httpOptions(forestServerToken),
      renderingId,
      collectionName,
    );
  }

  async getMcpWorkflowById(params: GetMcpWorkflowByIdParams): Promise<McpWorkflowLookup> {
    const { forestServerToken, renderingId, workflowId } = params;

    return this.resolveTransportMethod('getMcpWorkflowById')(
      this.httpOptions(forestServerToken),
      renderingId,
      workflowId,
    );
  }

  async triggerMcpWorkflow(params: TriggerMcpWorkflowParams): Promise<WorkflowRunTriggerResult> {
    const { forestServerToken, renderingId, workflowId, recordId } = params;

    return this.resolveTransportMethod('triggerMcpWorkflow')(
      this.httpOptions(forestServerToken),
      renderingId,
      workflowId,
      recordId,
    );
  }

  async getMcpWorkflowRun(params: GetMcpWorkflowRunParams): Promise<HydratedWorkflowRun> {
    const { forestServerToken, renderingId, runId } = params;

    return this.resolveTransportMethod('getMcpWorkflowRun')(
      this.httpOptions(forestServerToken),
      renderingId,
      runId,
    );
  }
}
