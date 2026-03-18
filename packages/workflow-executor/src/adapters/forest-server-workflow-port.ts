import type { McpConfiguration, WorkflowPort } from '../ports/workflow-port';
import type { PendingStepExecution } from '../types/execution';
import type { CollectionRef } from '../types/record';
import type { StepHistory } from '../types/step-history';
import type { HttpOptions } from '@forestadmin/forestadmin-client';

import { ServerUtils } from '@forestadmin/forestadmin-client';

// TODO: finalize route paths with the team — these are placeholders
const ROUTES = {
  pendingStepExecutions: '/liana/v1/workflow-step-executions/pending',
  updateStepExecution: (runId: string) => `/liana/v1/workflow-step-executions/${runId}/complete`,
  collectionRef: (collectionName: string) => `/liana/v1/collections/${collectionName}`,
  mcpServerConfigs: '/liana/mcp-server-configs-with-details',
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

  async updateStepExecution(runId: string, stepHistory: StepHistory): Promise<void> {
    await ServerUtils.query(
      this.options,
      'post',
      ROUTES.updateStepExecution(runId),
      {},
      stepHistory,
    );
  }

  async getCollectionRef(collectionName: string): Promise<CollectionRef> {
    return ServerUtils.query<CollectionRef>(
      this.options,
      'get',
      ROUTES.collectionRef(collectionName),
    );
  }

  async getMcpServerConfigs(): Promise<McpConfiguration[]> {
    return ServerUtils.query<McpConfiguration[]>(this.options, 'get', ROUTES.mcpServerConfigs);
  }
}
