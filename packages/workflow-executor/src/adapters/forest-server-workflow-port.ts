import type { McpConfiguration, WorkflowPort } from '../ports/workflow-port';
import type { PendingStepExecution } from '../types/execution';
import type { CollectionSchema } from '../types/record';
import type { StepOutcome } from '../types/step-outcome';
import type { HttpOptions } from '@forestadmin/forestadmin-client';

import { ServerUtils } from '@forestadmin/forestadmin-client';

// TODO: finalize route paths with the team — these are placeholders
const ROUTES = {
  pendingStepExecutions: '/liana/v1/workflow-step-executions/pending',
  pendingStepExecutionForRun: (runId: string) =>
    `/liana/v1/workflow-step-executions/pending?runId=${encodeURIComponent(runId)}`,
  updateStepExecution: (runId: string) => `/liana/v1/workflow-step-executions/${runId}/complete`,
  collectionSchema: (collectionName: string) => `/liana/v1/collections/${collectionName}`,
  mcpServerConfigs: '/liana/mcp-server-configs-with-details',
  runAccess: (runId: string) => `/liana/v1/workflow-runs/${encodeURIComponent(runId)}/access`,
};

export default class ForestServerWorkflowPort implements WorkflowPort {
  private readonly options: HttpOptions;

  constructor(params: { envSecret: string; forestServerUrl: string }) {
    this.options = { envSecret: params.envSecret, forestServerUrl: params.forestServerUrl };
  }

  async getPendingStepExecutions(): Promise<PendingStepExecution[]> {
    return ServerUtils.query<PendingStepExecution[]>(
      this.options,
      'get',
      ROUTES.pendingStepExecutions,
    );
  }

  async getPendingStepExecutionsForRun(runId: string): Promise<PendingStepExecution | null> {
    return ServerUtils.query<PendingStepExecution | null>(
      this.options,
      'get',
      ROUTES.pendingStepExecutionForRun(runId),
    );
  }

  async updateStepExecution(runId: string, stepOutcome: StepOutcome): Promise<void> {
    await ServerUtils.query(
      this.options,
      'post',
      ROUTES.updateStepExecution(runId),
      {},
      stepOutcome,
    );
  }

  async getCollectionSchema(collectionName: string): Promise<CollectionSchema> {
    return ServerUtils.query<CollectionSchema>(
      this.options,
      'get',
      ROUTES.collectionSchema(collectionName),
    );
  }

  async getMcpServerConfigs(): Promise<McpConfiguration[]> {
    return ServerUtils.query<McpConfiguration[]>(this.options, 'get', ROUTES.mcpServerConfigs);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async hasRunAccess(_runId: string, _userToken: string): Promise<boolean> {
    // TODO: implement once GET /liana/v1/workflow-runs/:runId/access is available.
    // When live: call ServerUtils.query with extra header 'forest-user-token': userToken
    // to let the orchestrator verify ownership.
    return true;
  }
}
