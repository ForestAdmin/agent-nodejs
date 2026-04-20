import type { ServerHydratedWorkflowRun } from './server-types';
import type { Logger } from '../ports/logger-port';
import type { McpConfiguration, WorkflowPort } from '../ports/workflow-port';
import type { PendingStepExecution, StepUser } from '../types/execution';
import type { CollectionSchema } from '../types/record';
import type { StepOutcome } from '../types/step-outcome';
import type { HttpOptions } from '@forestadmin/forestadmin-client';

import { ServerUtils } from '@forestadmin/forestadmin-client';

import ConsoleLogger from './console-logger';
import toPendingStepExecution from './run-to-pending-step-mapper';
import toUpdateStepRequest from './step-outcome-to-update-step-mapper';

const ROUTES = {
  pendingRuns: '/api/workflow-orchestrator/pending-run',
  availableRun: (runId: string) =>
    `/api/workflow-orchestrator/available-run/${encodeURIComponent(runId)}`,
  updateStep: '/api/workflow-orchestrator/update-step',
  collectionSchema: (collectionName: string, runId: string) =>
    `/api/workflow-orchestrator/collection-schema/${encodeURIComponent(
      collectionName,
    )}?runId=${encodeURIComponent(runId)}`,
  accessCheck: (runId: string, userId: number) =>
    `/api/workflow-orchestrator/run/${encodeURIComponent(runId)}/access-check?userId=${userId}`,
  mcpServerConfigs: '/liana/mcp-server-configs-with-details',
};

export default class ForestServerWorkflowPort implements WorkflowPort {
  private readonly options: HttpOptions;
  private readonly logger: Logger;

  constructor(params: { envSecret: string; forestServerUrl: string; logger?: Logger }) {
    this.options = { envSecret: params.envSecret, forestServerUrl: params.forestServerUrl };
    this.logger = params.logger ?? new ConsoleLogger();
  }

  async getPendingStepExecutions(): Promise<PendingStepExecution[]> {
    const runs = await ServerUtils.query<ServerHydratedWorkflowRun[]>(
      this.options,
      'get',
      ROUTES.pendingRuns,
    );

    return runs.reduce<PendingStepExecution[]>((acc, run) => {
      try {
        const step = toPendingStepExecution(run);
        if (step) acc.push(step);
      } catch (error) {
        this.logger.error('Failed to hydrate pending run — skipping', {
          runId: run.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      return acc;
    }, []);
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

  async getCollectionSchema(collectionName: string, runId: string): Promise<CollectionSchema> {
    return ServerUtils.query<CollectionSchema>(
      this.options,
      'get',
      ROUTES.collectionSchema(collectionName, runId),
    );
  }

  async getMcpServerConfigs(): Promise<McpConfiguration[]> {
    return ServerUtils.query<McpConfiguration[]>(this.options, 'get', ROUTES.mcpServerConfigs);
  }

  async hasRunAccess(runId: string, user: StepUser): Promise<boolean> {
    const { hasAccess } = await ServerUtils.query<{ hasAccess: boolean }>(
      this.options,
      'get',
      ROUTES.accessCheck(runId, user.id),
    );

    return hasAccess === true;
  }
}
