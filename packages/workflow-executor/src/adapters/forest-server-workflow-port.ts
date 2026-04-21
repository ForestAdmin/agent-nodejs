import type { ServerHydratedWorkflowRun } from './server-types';
import type { Logger } from '../ports/logger-port';
import type {
  MalformedRunInfo,
  McpConfiguration,
  PendingRunsBatch,
  WorkflowPort,
} from '../ports/workflow-port';
import type { PendingStepExecution, StepUser } from '../types/execution';
import type { CollectionSchema } from '../types/record';
import type { StepOutcome } from '../types/step-outcome';
import type { HttpOptions } from '@forestadmin/forestadmin-client';

import { ServerUtils } from '@forestadmin/forestadmin-client';

import ConsoleLogger from './console-logger';
import toPendingStepExecution from './run-to-pending-step-mapper';
import toUpdateStepRequest from './step-outcome-to-update-step-mapper';
import { MalformedRunError, WorkflowExecutorError, extractErrorMessage } from '../errors';

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

  async getPendingStepExecutions(): Promise<PendingRunsBatch> {
    const runs = await ServerUtils.query<ServerHydratedWorkflowRun[]>(
      this.options,
      'get',
      ROUTES.pendingRuns,
    );

    const pending: PendingStepExecution[] = [];
    const malformed: MalformedRunInfo[] = [];

    for (const run of runs) {
      try {
        const step = toPendingStepExecution(run);
        if (step) pending.push(step);
      } catch (error) {
        if (error instanceof WorkflowExecutorError) {
          malformed.push(this.toMalformedInfo(run, error));
        } else {
          this.logger.error('Failed to hydrate pending run — unexpected error', {
            runId: run.id,
            error: extractErrorMessage(error),
          });
        }
      }
    }

    return { pending, malformed };
  }

  async getPendingStepExecutionsForRun(runId: string): Promise<PendingStepExecution | null> {
    const run = await ServerUtils.query<ServerHydratedWorkflowRun | null>(
      this.options,
      'get',
      ROUTES.availableRun(runId),
    );

    if (!run) return null;

    try {
      return toPendingStepExecution(run);
    } catch (error) {
      if (error instanceof WorkflowExecutorError) {
        throw new MalformedRunError(this.toMalformedInfo(run, error));
      }

      throw error;
    }
  }

  /**
   * Pure mapping: build the domain-level MalformedRunInfo from a server run
   * that failed toPendingStepExecution. Extracts the stepId/stepIndex from
   * `workflowHistory` (first non-done, non-cancelled) when available — the
   * caller needs them to post an error outcome via updateStepExecution.
   * Returns null stepId/stepIndex when no pending step is identifiable.
   */
  private toMalformedInfo(
    run: ServerHydratedWorkflowRun,
    err: WorkflowExecutorError,
  ): MalformedRunInfo {
    const pending = run.workflowHistory.find(s => !s.done && !s.cancelled);

    return {
      runId: String(run.id),
      stepId: pending?.stepName ?? null,
      stepIndex: pending?.stepIndex ?? null,
      userMessage: err.userMessage,
      technicalMessage: err.message,
    };
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
