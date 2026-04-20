import type { ServerHydratedWorkflowRun } from './server-types';
import type { McpConfiguration, WorkflowPort } from '../ports/workflow-port';
import type { PendingStepExecution, StepUser } from '../types/execution';
import type { CollectionSchema } from '../types/record';
import type { StepOutcome } from '../types/step-outcome';
import type { HttpOptions } from '@forestadmin/forestadmin-client';

import { ServerUtils } from '@forestadmin/forestadmin-client';

import toPendingStepExecution from './run-to-pending-step-mapper';
import toUpdateStepRequest from './step-outcome-to-update-step-mapper';

const ROUTES = {
  pendingRuns: '/api/workflow-orchestrator/pending-run',
  availableRun: (runId: string) =>
    `/api/workflow-orchestrator/available-run/${encodeURIComponent(runId)}`,
  updateStep: '/api/workflow-orchestrator/update-step',
  collectionSchema: (collectionName: string) =>
    `/api/workflow-orchestrator/collection-schema/${encodeURIComponent(collectionName)}`,
  mcpServerConfigs: '/liana/mcp-server-configs-with-details',
};

export default class ForestServerWorkflowPort implements WorkflowPort {
  private readonly options: HttpOptions;

  constructor(params: { envSecret: string; forestServerUrl: string }) {
    this.options = { envSecret: params.envSecret, forestServerUrl: params.forestServerUrl };
  }

  async getPendingStepExecutions(): Promise<PendingStepExecution[]> {
    const runs = await ServerUtils.query<ServerHydratedWorkflowRun[]>(
      this.options,
      'get',
      ROUTES.pendingRuns,
    );

    return runs
      .map(run => toPendingStepExecution(run))
      .filter((step): step is PendingStepExecution => step !== null);
  }

  async getPendingStepExecutionsForRun(runId: string): Promise<PendingStepExecution | null> {
    const run = await ServerUtils.query<ServerHydratedWorkflowRun | null>(
      this.options,
      'get',
      ROUTES.availableRun(runId),
    );

    if (!run) return null;

    return toPendingStepExecution(run);
  }

  async updateStepExecution(runId: string, stepOutcome: StepOutcome): Promise<void> {
    const body = toUpdateStepRequest(runId, stepOutcome);
    await ServerUtils.query(this.options, 'post', ROUTES.updateStep, {}, body);
  }

  async getCollectionSchema(collectionName: string): Promise<CollectionSchema> {
    // TODO 4: the server endpoint requires a `runId` query param to resolve displayNames
    // from the correct rendering. This will be plumbed through once the interface supports it.
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
  async hasRunAccess(_runId: string, _user: StepUser): Promise<boolean> {
    // TODO: implement once an agent-auth access-check endpoint is available.
    // For now rely on the server already returning null for unauthorized runs.
    return true;
  }
}
