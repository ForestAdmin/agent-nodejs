import type { ServerHydratedWorkflowRun } from './server-types';
import type { Logger } from '../ports/logger-port';
import type {
  MalformedRunInfo,
  McpConfiguration,
  PendingRunDispatch,
  PendingRunsBatch,
  WorkflowPort,
} from '../ports/workflow-port';
import type { StepUser } from '../types/execution-context';
import type { CollectionSchema } from '../types/validated/collection';
import type { StepOutcome } from '../types/validated/step-outcome';
import type { HttpOptions } from '@forestadmin/forestadmin-client';

import { ServerUtils } from '@forestadmin/forestadmin-client';
import { z } from 'zod';

import ConsoleLogger from './console-logger';
import toPendingStepExecution from './run-to-pending-step-mapper';
import toUpdateStepRequest from './step-outcome-to-update-step-mapper';
import {
  DomainValidationError,
  InvalidStepDefinitionError,
  MalformedRunError,
  WorkflowExecutorError,
  WorkflowPortError,
  extractErrorMessage,
} from '../errors';
import { CollectionSchemaSchema } from '../types/validated/collection';

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
    const runs = await this.callPort('getPendingStepExecutions', () =>
      ServerUtils.query<ServerHydratedWorkflowRun[]>(this.options, 'get', ROUTES.pendingRuns),
    );

    const pending: PendingRunDispatch[] = [];
    const malformed: MalformedRunInfo[] = [];

    for (const run of runs) {
      try {
        const dispatch = this.toDispatch(run);
        if (dispatch) pending.push(dispatch);
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

  async getPendingStepExecutionsForRun(runId: string): Promise<PendingRunDispatch | null> {
    const run = await this.callPort('getPendingStepExecutionsForRun', () =>
      ServerUtils.query<ServerHydratedWorkflowRun | null>(
        this.options,
        'get',
        ROUTES.availableRun(runId),
      ),
    );

    if (!run) return null;

    try {
      return this.toDispatch(run);
    } catch (error) {
      if (error instanceof WorkflowExecutorError) {
        throw new MalformedRunError(this.toMalformedInfo(run, error));
      }

      /* istanbul ignore next — defensive fallback for unexpected non-domain errors */
      throw error;
    }
  }

  // Validates userProfile + serverToken at the adapter boundary. Split into two checks so an
  // operator can diagnose "userProfile missing" vs "serverToken missing" from the error alone.
  private toDispatch(run: ServerHydratedWorkflowRun): PendingRunDispatch | null {
    if (!run.userProfile) {
      throw new InvalidStepDefinitionError(
        `Run ${run.id} is missing required field userProfile — ` +
          `the orchestrator must include it in the run payload`,
      );
    }

    const token = run.userProfile.serverToken;

    if (typeof token !== 'string' || !token) {
      throw new InvalidStepDefinitionError(
        `Run ${run.id} userProfile is missing serverToken — ` +
          `the orchestrator must include it in the run payload`,
      );
    }

    const step = toPendingStepExecution(run);
    if (!step) return null;

    return { step, auth: { forestServerToken: token } };
  }

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

  async updateStepExecution(
    runId: string,
    stepOutcome: StepOutcome,
  ): Promise<PendingRunDispatch | null> {
    return this.callPort('updateStepExecution', async () => {
      const body = toUpdateStepRequest(runId, stepOutcome);
      const run = await ServerUtils.query<ServerHydratedWorkflowRun | null>(
        this.options,
        'post',
        ROUTES.updateStep,
        {},
        body,
      );

      if (!run) return null;

      try {
        return this.toDispatch(run);
      } catch (error) {
        // The outcome was recorded server-side; only the chain parse failed. Fall back to the
        // next poll cycle — don't let a malformed chain response mask the successful update.
        this.logger.error('Failed to parse chained next step from /update-step response', {
          runId: String(run.id),
          error: extractErrorMessage(error),
        });

        return null;
      }
    });
  }

  async getCollectionSchema(collectionName: string, runId: string): Promise<CollectionSchema> {
    return this.callPort('getCollectionSchema', async () => {
      const response = await ServerUtils.query<unknown>(
        this.options,
        'get',
        ROUTES.collectionSchema(collectionName, runId),
      );

      try {
        return CollectionSchemaSchema.parse(response);
      } catch (err) {
        if (err instanceof z.ZodError) {
          // runId is passed for observability — the schema call is scoped to a run.
          throw new DomainValidationError(Number(runId) || 0, err);
        }

        /* istanbul ignore next — zod.parse only throws ZodError; defensive fallback */
        throw err;
      }
    });
  }

  async getMcpServerConfigs(): Promise<McpConfiguration[]> {
    return this.callPort('getMcpServerConfigs', () =>
      ServerUtils.query<McpConfiguration[]>(this.options, 'get', ROUTES.mcpServerConfigs),
    );
  }

  async hasRunAccess(runId: string, user: StepUser): Promise<boolean> {
    return this.callPort('hasRunAccess', async () => {
      const { hasAccess } = await ServerUtils.query<{ hasAccess: boolean }>(
        this.options,
        'get',
        ROUTES.accessCheck(runId, user.id),
      );

      return hasAccess === true;
    });
  }

  private async callPort<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (cause) {
      if (cause instanceof WorkflowExecutorError) throw cause;
      throw new WorkflowPortError(operation, cause);
    }
  }
}
