import type { StepContextConfig } from './executors/step-executor-factory';
import type { ActivityLogPortFactory } from './ports/activity-log-port';
import type { AgentPort } from './ports/agent-port';
import type { AiModelPort } from './ports/ai-model-port';
import type { Logger } from './ports/logger-port';
import type { RunStore } from './ports/run-store';
import type {
  MalformedRunInfo,
  McpConfiguration,
  PendingRunDispatch,
  WorkflowPort,
} from './ports/workflow-port';
import type SchemaCache from './schema-cache';
import type { PendingStepExecution, StepExecutionResult } from './types/execution-context';
import type { StepExecutionData } from './types/step-execution-data';
import type { StepOutcome } from './types/validated/step-outcome';
import type { RemoteTool } from '@forestadmin/ai-proxy';

import ConsoleLogger from './adapters/console-logger';
import {
  MalformedRunError,
  RunNotFoundError,
  UserMismatchError,
  causeMessage,
  extractErrorMessage,
} from './errors';
import StepExecutorFactory from './executors/step-executor-factory';
import { stepTypeToOutcomeType } from './types/validated/step-outcome';
import validateSecrets from './validate-secrets';

export type RunnerState = 'idle' | 'running' | 'draining' | 'stopped';

// Default cap on auto-chained steps per entry (initial step + chained). High enough to cover
// realistic auto workflows; low enough to fail loud if a workflow misbehaves.
const DEFAULT_MAX_CHAIN_DEPTH = 50;
const DEFAULT_STOP_TIMEOUT_MS = 30_000;

export interface RunnerConfig {
  agentPort: AgentPort;
  workflowPort: WorkflowPort;
  runStore: RunStore;
  schemaCache: SchemaCache;
  pollingIntervalMs: number;
  aiModelPort: AiModelPort;
  activityLogPortFactory: ActivityLogPortFactory;
  envSecret: string;
  authSecret: string;
  logger?: Logger;
  stopTimeoutMs?: number;
  // On timeout the step reports status:error; the underlying work is not aborted (Promise.race
  // limitation). Late rejections are caught and logged; late resolutions are silently discarded.
  stepTimeoutMs?: number;
  // Max number of ADDITIONAL steps auto-chained via /update-step response before yielding to the
  // next poll cycle (counted after the initial step). 0 disables chaining entirely. Default 50.
  maxChainDepth?: number;
}

export default class Runner {
  private readonly config: RunnerConfig;
  private pollingTimer: NodeJS.Timeout | null = null;
  // Keyed by runId (not stepId): a run has one pending step at a time, and a chain advances the
  // stepId between iterations. Keying by runId keeps the dedup guarantee across the whole chain.
  private readonly inFlightRuns = new Map<string, Promise<void>>();
  private isRunning = false;
  private readonly logger: Logger;
  private _state: RunnerState = 'idle';

  constructor(config: RunnerConfig) {
    this.config = config;
    this.logger = config.logger ?? new ConsoleLogger();
  }

  get state(): RunnerState {
    return this._state;
  }

  async start(): Promise<void> {
    if (this._state === 'stopped' || this._state === 'draining') {
      throw new Error('Runner has been stopped and cannot be restarted');
    }

    if (this.isRunning) return;

    validateSecrets({ envSecret: this.config.envSecret, authSecret: this.config.authSecret });

    // Probe the agent first so we fail fast without opening DB connections when unreachable.
    await this.config.agentPort.probe();
    this.logger.info('Agent probe passed', {});
    await this.config.runStore.init(this.logger);

    this.isRunning = true;
    this._state = 'running';

    this.schedulePoll();
  }

  async stop(): Promise<void> {
    if (this._state === 'idle' || this._state === 'stopped' || this._state === 'draining') return;

    this._state = 'draining';
    this.isRunning = false;

    if (this.pollingTimer !== null) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }

    try {
      // Drain in-flight runs (each entry may cover a whole auto-chain).
      if (this.inFlightRuns.size > 0) {
        this.logger.info?.('Draining in-flight runs', {
          count: this.inFlightRuns.size,
          runs: [...this.inFlightRuns.keys()],
        });

        const timeout = this.config.stopTimeoutMs ?? DEFAULT_STOP_TIMEOUT_MS;
        let drainTimer: NodeJS.Timeout | undefined;
        const drainResult = await Promise.race([
          Promise.allSettled(this.inFlightRuns.values()).then(() => {
            if (drainTimer) clearTimeout(drainTimer);

            return 'drained' as const;
          }),
          new Promise<'timeout'>(resolve => {
            drainTimer = setTimeout(() => resolve('timeout'), timeout);
          }),
        ]);

        if (drainResult === 'timeout') {
          this.logger.error('Drain timeout — runs still in flight', {
            remainingRuns: [...this.inFlightRuns.keys()],
            timeoutMs: timeout,
          });
        } else {
          this.logger.info?.('All in-flight runs drained', {});
        }
      }

      // Wait for fire-and-forget activity-log transitions to settle before closing resources —
      // otherwise audit-trail rows can be left stuck in Pending.
      await this.config.activityLogPortFactory.drain();

      const results = await Promise.allSettled([
        this.config.aiModelPort.closeConnections(),
        this.config.runStore.close(this.logger),
      ]);

      for (const result of results) {
        if (result.status === 'rejected') {
          this.logger.error('Resource cleanup failed during shutdown', {
            error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          });
        }
      }
    } finally {
      this._state = 'stopped';
    }
  }

  async getRunStepExecutions(runId: string): Promise<StepExecutionData[]> {
    return this.config.runStore.getStepExecutions(runId);
  }

  async triggerPoll(
    runId: string,
    options?: { pendingData?: unknown; bearerUserId?: number },
  ): Promise<void> {
    let dispatch: PendingRunDispatch | null;

    try {
      dispatch = await this.config.workflowPort.getPendingStepExecutionsForRun(runId);
    } catch (err) {
      if (err instanceof MalformedRunError) {
        await this.reportMalformedRun(err.info);
      }

      throw err;
    }

    if (!dispatch) throw new RunNotFoundError(runId);

    const { step, auth } = dispatch;

    if (options?.bearerUserId !== undefined && step.user.id !== options.bearerUserId) {
      throw new UserMismatchError(runId);
    }

    if (this.inFlightRuns.has(step.runId)) return;

    await this.executeStep(step, auth.forestServerToken, options?.pendingData);
  }

  private schedulePoll(): void {
    if (!this.isRunning) return;
    this.pollingTimer = setTimeout(() => this.runPollCycle(), this.config.pollingIntervalMs);
  }

  private async runPollCycle(): Promise<void> {
    try {
      const { pending, malformed } = await this.config.workflowPort.getPendingStepExecutions();
      // Each reportMalformedRun has its own try/catch, no individual failure poisons the cycle.
      await Promise.allSettled(malformed.map(info => this.reportMalformedRun(info)));

      const dispatchable = pending.filter(d => !this.inFlightRuns.has(d.step.runId));
      this.logger.info('Poll cycle completed', {
        fetched: pending.length,
        dispatching: dispatchable.length,
        malformed: malformed.length,
      });
      await Promise.allSettled(
        dispatchable.map(d => this.executeStep(d.step, d.auth.forestServerToken)),
      );
    } catch (error) {
      this.logger.error('Poll cycle failed', {
        error: extractErrorMessage(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    } finally {
      this.schedulePoll();
    }
  }

  // Posts an error outcome so the orchestrator marks the run failed and stops re-dispatching it.
  // Idempotent server-side. If stepIndex is null (empty/corrupt history), log loudly and skip —
  // ops has to clean up manually.
  private async reportMalformedRun(info: MalformedRunInfo): Promise<void> {
    if (info.stepId === null || info.stepIndex === null) {
      this.logger.error('Malformed run cannot be reported — no pending step identified', {
        runId: info.runId,
        error: info.technicalMessage,
      });

      return;
    }

    try {
      await this.config.workflowPort.updateStepExecution(info.runId, {
        type: 'record',
        stepId: info.stepId,
        stepIndex: info.stepIndex,
        status: 'error',
        error: info.userMessage,
      });
      this.logger.error('Malformed run reported as error', {
        runId: info.runId,
        stepIndex: info.stepIndex,
        error: info.technicalMessage,
      });
    } catch (reportErr) {
      this.logger.error('Malformed run — also failed to report', {
        runId: info.runId,
        mappingError: info.technicalMessage,
        reportError: extractErrorMessage(reportErr),
      });
    }
  }

  private async fetchRemoteTools(): Promise<RemoteTool[]> {
    const configs = await this.config.workflowPort.getMcpServerConfigs();
    if (configs.length === 0) return [];

    const mergedConfig: McpConfiguration = {
      ...configs[0],
      configs: Object.assign({}, ...configs.map(c => c.configs)),
    };

    return this.config.aiModelPort.loadRemoteTools(mergedConfig);
  }

  private executeStep(
    step: PendingStepExecution,
    forestServerToken: string,
    incomingPendingData?: unknown,
  ): Promise<void> {
    // The tracked promise covers the entire auto-chain for this run plus the map cleanup —
    // register it once, clean up once. Storing per-step entries (or Promise.resolve()) would
    // break drain: Promise.allSettled would see already-resolved entries and stop waiting while
    // the chain is still running.
    const trackedPromise = this.doExecuteStep(step, forestServerToken, incomingPendingData).finally(
      () => {
        this.inFlightRuns.delete(step.runId);
      },
    );
    this.inFlightRuns.set(step.runId, trackedPromise);

    return trackedPromise;
  }

  private async doExecuteStep(
    step: PendingStepExecution,
    forestServerToken: string,
    incomingPendingData?: unknown,
  ): Promise<void> {
    let currentStep = step;
    let currentToken = forestServerToken;
    let currentIncomingData = incomingPendingData;
    let chainedCount = 0; // additional steps chained after the initial one
    const maxDepth = this.config.maxChainDepth ?? DEFAULT_MAX_CHAIN_DEPTH;

    // Sequential by design: each step's outcome drives the next dispatch; steps within one run
    // cannot overlap. The no-await-in-loop rule doesn't apply here.
    /* eslint-disable no-await-in-loop, no-constant-condition */
    while (true) {
      let result: StepExecutionResult;

      try {
        const executor = await StepExecutorFactory.create(
          currentStep,
          this.contextConfig,
          this.config.activityLogPortFactory.forRun(currentToken),
          () => this.fetchRemoteTools(),
          currentIncomingData,
        );
        result = await executor.execute();
      } catch (error) {
        this.logger.error('FATAL: executor contract violated — reporting synthetic error outcome', {
          runId: currentStep.runId,
          stepId: currentStep.stepId,
          stepIndex: currentStep.stepIndex,
          error: extractErrorMessage(error),
        });

        // Report a synthetic error outcome so the orchestrator marks the run failed and stops
        // re-dispatching — without this, the contract-violating step loops forever.
        const syntheticOutcome: StepOutcome = {
          type: stepTypeToOutcomeType(currentStep.stepDefinition.type),
          stepId: currentStep.stepId,
          stepIndex: currentStep.stepIndex,
          status: 'error',
          error: 'An unexpected error occurred.',
        };

        try {
          await this.config.workflowPort.updateStepExecution(currentStep.runId, syntheticOutcome);
        } catch (reportErr) {
          this.logger.error('FATAL: also failed to report synthetic error outcome', {
            runId: currentStep.runId,
            stepId: currentStep.stepId,
            reportError: extractErrorMessage(reportErr),
          });
        }

        return;
      }

      let nextDispatch: PendingRunDispatch | null;

      try {
        nextDispatch = await this.config.workflowPort.updateStepExecution(
          currentStep.runId,
          result.stepOutcome,
        );
      } catch (error) {
        this.logger.error('Failed to report step outcome', {
          runId: currentStep.runId,
          stepId: currentStep.stepId,
          stepIndex: currentStep.stepIndex,
          error: extractErrorMessage(error),
          cause: causeMessage(error),
          stack: error instanceof Error ? error.stack : undefined,
        });

        return;
      }

      if (nextDispatch === null) return;

      // Progression safety: the server must advance the workflow within the same run. A cross-run
      // dispatch would execute under the initial run's inFlightRuns key (and leak the map entry
      // on cleanup); a non-progressing stepIndex would loop forever. Both are server bugs —
      // exit the chain and let the next poll re-fetch authoritative state.
      if (
        nextDispatch.step.runId !== currentStep.runId ||
        nextDispatch.step.stepIndex <= currentStep.stepIndex
      ) {
        this.logger.error('Server returned non-progressing next step — exiting chain', {
          runId: currentStep.runId,
          currentStepIndex: currentStep.stepIndex,
          returnedRunId: nextDispatch.step.runId,
          returnedStepIndex: nextDispatch.step.stepIndex,
        });

        return;
      }

      // Cap check BEFORE incrementing: chainedCount counts chained steps we've already executed.
      // maxDepth=2 means "run up to 2 chained steps after the initial one" (3 total).
      if (chainedCount >= maxDepth) {
        this.logger.info?.('Chain depth cap reached — yielding to next poll', {
          runId: currentStep.runId,
          stepIndex: currentStep.stepIndex,
          maxDepth,
        });

        return;
      }

      // Graceful stop: finish the current step, then yield instead of chaining further.
      if (this._state === 'draining') {
        this.logger.info?.('Chain interrupted by stop() — yielding', {
          runId: currentStep.runId,
          stepIndex: currentStep.stepIndex,
        });

        return;
      }

      chainedCount += 1;
      currentStep = nextDispatch.step;
      currentToken = nextDispatch.auth.forestServerToken;
      currentIncomingData = undefined; // chained steps never carry pending data
    }
    /* eslint-enable no-await-in-loop, no-constant-condition */
  }

  private get contextConfig(): StepContextConfig {
    return {
      aiModelPort: this.config.aiModelPort,
      agentPort: this.config.agentPort,
      workflowPort: this.config.workflowPort,
      runStore: this.config.runStore,
      schemaCache: this.config.schemaCache,
      logger: this.logger,
      stepTimeoutMs: this.config.stepTimeoutMs,
    };
  }
}
