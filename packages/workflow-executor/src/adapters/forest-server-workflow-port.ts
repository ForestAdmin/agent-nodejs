import type { ServerHydratedWorkflowRun } from './server-types';
import type { Logger } from '../ports/logger-port';
import type {
  AvailableRunDispatch,
  AvailableRunsBatch,
  MalformedRunInfo,
  WorkflowPort,
} from '../ports/workflow-port';
import type { CollectionSchema } from '../types/validated/collection';
import type { StepOutcome } from '../types/validated/step-outcome';
import type { ToolConfig } from '@forestadmin/ai-proxy';
import type { HttpOptions } from '@forestadmin/forestadmin-client';

import { ServerUtils } from '@forestadmin/forestadmin-client';
import { z } from 'zod';

import createConsoleLogger from './console-logger';
import toAvailableStepExecution from './run-to-available-step-mapper';
import toUpdateStepRequest from './step-outcome-to-update-step-mapper';
import withRetry from './with-retry';
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
  executorVersion: '/api/workflow-orchestrator/executor-version',
  collectionSchema: (collectionName: string, runId: string) =>
    `/api/workflow-orchestrator/collection-schema/${encodeURIComponent(
      collectionName,
    )}?runId=${encodeURIComponent(runId)}`,
  accessCheck: (runId: string, userId: number) =>
    `/api/workflow-orchestrator/run/${encodeURIComponent(runId)}/access-check?userId=${userId}`,
  mcpServerConfigs: '/liana/mcp-server-configs-with-details',
};

// Forest sends relatedCollectionName as a `collection.targetKey` reference (e.g. "store.id");
// normalize it to a plain collection name (the related PK comes from the schema's primaryKeyFields).
function stripReferenceKey(name: string | undefined): string | undefined {
  return name?.includes('.') ? name.slice(0, name.lastIndexOf('.')) : name;
}

export default class ForestServerWorkflowPort implements WorkflowPort {
  private readonly options: HttpOptions;
  private readonly logger: Logger;

  constructor(params: { envSecret: string; forestServerUrl: string; logger?: Logger }) {
    this.options = { envSecret: params.envSecret, forestServerUrl: params.forestServerUrl };
    this.logger = params.logger ?? createConsoleLogger();
  }

  async getAvailableRuns(): Promise<AvailableRunsBatch> {
    const runs = await this.callPort('getAvailableRuns', () =>
      ServerUtils.query<ServerHydratedWorkflowRun[]>(this.options, 'get', ROUTES.pendingRuns),
    );

    const pending: AvailableRunDispatch[] = [];
    const malformed: MalformedRunInfo[] = [];

    for (const run of runs) {
      try {
        const dispatch = this.toDispatch(run);
        if (dispatch) pending.push(dispatch);
      } catch (error) {
        if (error instanceof WorkflowExecutorError) {
          malformed.push(this.toMalformedInfo(run, error));
        } else {
          this.logger('Error', 'Failed to hydrate pending run — unexpected error', {
            runId: run.id,
            error: extractErrorMessage(error),
          });
        }
      }
    }

    return { pending, malformed };
  }

  async getAvailableRun(runId: string): Promise<AvailableRunDispatch | null> {
    const run = await this.callPort('getAvailableRun', () =>
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
  private toDispatch(run: ServerHydratedWorkflowRun): AvailableRunDispatch | null {
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

    const step = toAvailableStepExecution(run);
    if (!step) return null;

    return { step, auth: { forestServerToken: token } };
  }

  private toMalformedInfo(
    run: ServerHydratedWorkflowRun,
    err: WorkflowExecutorError,
  ): MalformedRunInfo {
    const pending = run.workflowHistory.at(-1) ?? null;

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
  ): Promise<AvailableRunDispatch | null> {
    return this.callPort(
      'updateStepExecution',
      async () => {
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
          this.logger('Error', 'Failed to parse chained next step from /update-step response', {
            runId: String(run.id),
            error: extractErrorMessage(error),
          });

          return null;
        }
      },
      { retry: true },
    );
  }

  async getCollectionSchema(collectionName: string, runId: string): Promise<CollectionSchema> {
    return this.callPort(
      'getCollectionSchema',
      async () => {
        const response = await ServerUtils.query<unknown>(
          this.options,
          'get',
          ROUTES.collectionSchema(collectionName, runId),
        );

        try {
          const schema = CollectionSchemaSchema.parse(response);

          return {
            ...schema,
            fields: schema.fields.map(field => ({
              ...field,
              relatedCollectionName: stripReferenceKey(field.relatedCollectionName),
            })),
          };
        } catch (err) {
          if (err instanceof z.ZodError) {
            // runId is passed for observability — the schema call is scoped to a run.
            throw new DomainValidationError(Number(runId) || 0, err);
          }

          /* istanbul ignore next — zod.parse only throws ZodError; defensive fallback */
          throw err;
        }
      },
      { retry: true },
    );
  }

  async reportExecutorVersion(version: string): Promise<void> {
    await this.callPort(
      'reportExecutorVersion',
      () => ServerUtils.query<void>(this.options, 'post', ROUTES.executorVersion, {}, { version }),
      { retry: true },
    );
  }

  async getMcpServerConfigs(): Promise<Record<string, ToolConfig>> {
    return this.callPort(
      'getMcpServerConfigs',
      () =>
        ServerUtils.query<Record<string, ToolConfig>>(this.options, 'get', ROUTES.mcpServerConfigs),
      { retry: true },
    );
  }

  async hasRunAccess(runId: string, user: { id: number }): Promise<boolean> {
    return this.callPort('hasRunAccess', async () => {
      const { hasAccess } = await ServerUtils.query<{ hasAccess: boolean }>(
        this.options,
        'get',
        ROUTES.accessCheck(runId, user.id),
      );

      return hasAccess === true;
    });
  }

  private async callPort<T>(
    operation: string,
    fn: () => Promise<T>,
    options?: { retry?: boolean },
  ): Promise<T> {
    const run = options?.retry ? () => withRetry(operation, fn, { logger: this.logger }) : fn;

    try {
      return await run();
    } catch (cause) {
      if (cause instanceof WorkflowExecutorError) throw cause;
      throw new WorkflowPortError(operation, cause);
    }
  }
}
