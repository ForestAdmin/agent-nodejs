import type { StepContextConfig } from './executors/step-executor-factory';
import type { AgentPort } from './ports/agent-port';
import type { AiModelPort } from './ports/ai-model-port';
import type { Logger } from './ports/logger-port';
import type { RunStore } from './ports/run-store';
import type { McpConfiguration, WorkflowPort } from './ports/workflow-port';
import type SchemaCache from './schema-cache';
import type { PendingStepExecution, StepExecutionResult } from './types/execution';
import type { StepExecutionData } from './types/step-execution-data';
import type { RemoteTool } from '@forestadmin/ai-proxy';

import ConsoleLogger from './adapters/console-logger';
import { RunNotFoundError, UserMismatchError, causeMessage, extractErrorMessage } from './errors';
import StepExecutorFactory from './executors/step-executor-factory';
import validateSecrets from './validate-secrets';

export type RunnerState = 'idle' | 'running' | 'draining' | 'stopped';

export interface RunnerConfig {
  agentPort: AgentPort;
  workflowPort: WorkflowPort;
  runStore: RunStore;
  schemaCache: SchemaCache;
  pollingIntervalMs: number;
  aiModelPort: AiModelPort;
  envSecret: string;
  authSecret: string;
  logger?: Logger;
  stopTimeoutMs?: number;
  /**
   * Max duration of a single step's execution. Unset or <= 0 = no timeout.
   * On timeout, the step reports `status: 'error'` to the orchestrator with a
   * user-facing message. The underlying work is NOT aborted: late rejections from
   * the agent/LLM are caught and logged; late resolutions are silently discarded.
   */
  stepTimeoutMs?: number;
}

const DEFAULT_STOP_TIMEOUT_MS = 30_000;

export default class Runner {
  private readonly config: RunnerConfig;
  private pollingTimer: NodeJS.Timeout | null = null;
  private readonly inFlightSteps = new Map<string, Promise<void>>();
  private isRunning = false;
  private readonly logger: Logger;
  private _state: RunnerState = 'idle';

  private static stepKey(step: PendingStepExecution): string {
    return `${step.runId}:${step.stepId}`;
  }

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

    // Probe the agent first (cheap network check) so we fail fast without
    // opening database connections when the agent is unreachable. Only flip
    // the running flags after both probe and migrations succeed.
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
      // Drain in-flight steps
      if (this.inFlightSteps.size > 0) {
        this.logger.info?.('Draining in-flight steps', {
          count: this.inFlightSteps.size,
          steps: [...this.inFlightSteps.keys()],
        });

        const timeout = this.config.stopTimeoutMs ?? DEFAULT_STOP_TIMEOUT_MS;
        let drainTimer: NodeJS.Timeout | undefined;
        const drainResult = await Promise.race([
          Promise.allSettled(this.inFlightSteps.values()).then(() => {
            if (drainTimer) clearTimeout(drainTimer);

            return 'drained' as const;
          }),
          new Promise<'timeout'>(resolve => {
            drainTimer = setTimeout(() => resolve('timeout'), timeout);
          }),
        ]);

        if (drainResult === 'timeout') {
          this.logger.error('Drain timeout — steps still in flight', {
            remainingSteps: [...this.inFlightSteps.keys()],
            timeoutMs: timeout,
          });
        } else {
          this.logger.info?.('All in-flight steps drained', {});
        }
      }

      // Close resources — log failures instead of silently swallowing
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
    const step = await this.config.workflowPort.getPendingStepExecutionsForRun(runId);

    if (!step) throw new RunNotFoundError(runId);

    if (options?.bearerUserId !== undefined && step.user.id !== options.bearerUserId) {
      throw new UserMismatchError(runId);
    }

    if (this.inFlightSteps.has(Runner.stepKey(step))) return;

    await this.executeStep(step, options?.pendingData);
  }

  private schedulePoll(): void {
    if (!this.isRunning) return;
    this.pollingTimer = setTimeout(() => this.runPollCycle(), this.config.pollingIntervalMs);
  }

  private async runPollCycle(): Promise<void> {
    try {
      const steps = await this.config.workflowPort.getPendingStepExecutions();
      const pending = steps.filter(s => !this.inFlightSteps.has(Runner.stepKey(s)));
      this.logger.info('Poll cycle completed', {
        fetched: steps.length,
        dispatching: pending.length,
      });
      await Promise.allSettled(pending.map(s => this.executeStep(s)));
    } catch (error) {
      this.logger.error('Poll cycle failed', {
        error: extractErrorMessage(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    } finally {
      this.schedulePoll();
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

  private executeStep(step: PendingStepExecution, incomingPendingData?: unknown): Promise<void> {
    const key = Runner.stepKey(step);
    const promise = this.doExecuteStep(step, key, incomingPendingData);
    this.inFlightSteps.set(key, promise);

    return promise;
  }

  private async doExecuteStep(
    step: PendingStepExecution,
    key: string,
    incomingPendingData?: unknown,
  ): Promise<void> {
    let result: StepExecutionResult;

    try {
      const executor = await StepExecutorFactory.create(
        step,
        this.contextConfig,
        () => this.fetchRemoteTools(),
        incomingPendingData,
      );
      result = await executor.execute();
    } catch (error) {
      this.logger.error('FATAL: executor contract violated — step outcome not reported', {
        runId: step.runId,
        stepId: step.stepId,
        error: extractErrorMessage(error),
      });

      return;
    } finally {
      this.inFlightSteps.delete(key);
    }

    try {
      await this.config.workflowPort.updateStepExecution(step.runId, result.stepOutcome);
    } catch (error) {
      this.logger.error('Failed to report step outcome', {
        runId: step.runId,
        stepId: step.stepId,
        stepIndex: step.stepIndex,
        error: extractErrorMessage(error),
        cause: causeMessage(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
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
