import type { StepContextConfig } from './executors/step-executor-factory';
import type { AgentPort } from './ports/agent-port';
import type { Logger } from './ports/logger-port';
import type { RunStore } from './ports/run-store';
import type { McpConfiguration, WorkflowPort } from './ports/workflow-port';
import type SchemaCache from './schema-cache';
import type { PendingStepExecution, StepExecutionResult } from './types/execution';
import type { StepExecutionData } from './types/step-execution-data';
import type { AiClient, RemoteTool } from '@forestadmin/ai-proxy';

import ConsoleLogger from './adapters/console-logger';
import {
  InvalidPendingDataError,
  PendingDataNotFoundError,
  RunNotFoundError,
  UserMismatchError,
  causeMessage,
} from './errors';
import StepExecutorFactory from './executors/step-executor-factory';
import ExecutorHttpServer from './http/executor-http-server';
import patchBodySchemas from './pending-data-validators';
import validateSecrets from './validate-secrets';

export type RunnerState = 'idle' | 'running' | 'draining' | 'stopped';

export interface RunnerConfig {
  agentPort: AgentPort;
  workflowPort: WorkflowPort;
  runStore: RunStore;
  schemaCache: SchemaCache;
  pollingIntervalMs: number;
  aiClient: AiClient;
  envSecret: string;
  authSecret: string;
  logger?: Logger;
  httpPort?: number;
  stopTimeoutMs?: number;
}

const DEFAULT_STOP_TIMEOUT_MS = 30_000;

export default class Runner {
  private readonly config: RunnerConfig;
  private httpServer: ExecutorHttpServer | null = null;
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
    if (this.isRunning) return;

    validateSecrets({ envSecret: this.config.envSecret, authSecret: this.config.authSecret });

    this.isRunning = true;
    this._state = 'running';

    try {
      await this.config.runStore.init(this.logger);

      if (this.config.httpPort !== undefined && !this.httpServer) {
        const server = new ExecutorHttpServer({
          port: this.config.httpPort,
          runner: this,
          authSecret: this.config.authSecret,
          workflowPort: this.config.workflowPort,
          logger: this.logger,
        });
        await server.start();
        this.httpServer = server;
      }
    } catch (error) {
      this.isRunning = false;
      this._state = 'idle';
      throw error;
    }

    this.schedulePoll();
  }

  async stop(): Promise<void> {
    this._state = 'draining';
    this.isRunning = false;

    if (this.pollingTimer !== null) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }

    // Drain in-flight steps
    if (this.inFlightSteps.size > 0) {
      this.logger.info?.('Draining in-flight steps', {
        count: this.inFlightSteps.size,
        steps: [...this.inFlightSteps.keys()],
      });

      const timeout = this.config.stopTimeoutMs ?? DEFAULT_STOP_TIMEOUT_MS;
      const drainResult = await Promise.race([
        Promise.allSettled(this.inFlightSteps.values()).then(() => 'drained' as const),
        new Promise<'timeout'>(resolve => {
          setTimeout(() => resolve('timeout'), timeout);
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

    // Close resources after drain
    if (this.httpServer) {
      await this.httpServer.stop();
      this.httpServer = null;
    }

    await Promise.allSettled([
      this.config.aiClient.closeConnections(),
      this.config.runStore.close(this.logger),
    ]);

    this._state = 'stopped';
  }

  async getRunStepExecutions(runId: string): Promise<StepExecutionData[]> {
    return this.config.runStore.getStepExecutions(runId);
  }

  private async patchPendingData(runId: string, stepIndex: number, body: unknown): Promise<void> {
    const stepExecutions = await this.config.runStore.getStepExecutions(runId);
    const execution = stepExecutions.find(e => e.stepIndex === stepIndex);
    const schema = execution ? patchBodySchemas[execution.type] : undefined;

    // pendingData is typed as T | undefined; null is not expected (RunStore never persists null)
    // but `== null` guards against both for safety.
    if (!execution || !schema || !('pendingData' in execution) || execution.pendingData == null) {
      throw new PendingDataNotFoundError(runId, stepIndex);
    }

    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      throw new InvalidPendingDataError(
        parsed.error.issues.map(({ path, message, code }) => ({
          path: path as (string | number)[],
          message,
          code,
        })),
      );
    }

    // Cast is safe: the type guard above ensures `execution` is the correct union branch,
    // and patchBodySchemas[execution.type] only accepts keys valid for that branch.
    await this.config.runStore.saveStepExecution(runId, {
      ...execution,
      pendingData: { ...(execution.pendingData as object), ...(parsed.data as object) },
    } as StepExecutionData);
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

    if (options?.pendingData !== undefined) {
      await this.patchPendingData(runId, step.stepIndex, options.pendingData);
    }

    if (this.inFlightSteps.has(Runner.stepKey(step))) return;

    await this.executeStep(step);
  }

  private schedulePoll(): void {
    if (!this.isRunning) return;
    this.pollingTimer = setTimeout(() => this.runPollCycle(), this.config.pollingIntervalMs);
  }

  private async runPollCycle(): Promise<void> {
    try {
      const steps = await this.config.workflowPort.getPendingStepExecutions();
      const pending = steps.filter(s => !this.inFlightSteps.has(Runner.stepKey(s)));
      await Promise.allSettled(pending.map(s => this.executeStep(s)));
    } catch (error) {
      this.logger.error('Poll cycle failed', {
        error: error instanceof Error ? error.message : String(error),
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

    return this.config.aiClient.loadRemoteTools(mergedConfig);
  }

  private executeStep(step: PendingStepExecution): Promise<void> {
    const key = Runner.stepKey(step);
    const promise = this.doExecuteStep(step, key);
    this.inFlightSteps.set(key, promise);

    return promise;
  }

  private async doExecuteStep(
    step: PendingStepExecution,
    key: string,
  ): Promise<void> {
    let result: StepExecutionResult;

    try {
      const executor = await StepExecutorFactory.create(step, this.contextConfig, () =>
        this.fetchRemoteTools(),
      );
      result = await executor.execute();
    } catch (error) {
      // This block should never execute: the factory and executor contracts guarantee no rejection.
      // It guards against future regressions.
      this.logger.error('FATAL: executor contract violated — step outcome not reported', {
        runId: step.runId,
        stepId: step.stepId,
        error: error instanceof Error ? error.message : String(error),
      });

      return; // Cannot report an outcome: the orchestrator will timeout on this step
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
        error: error instanceof Error ? error.message : String(error),
        cause: causeMessage(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  private get contextConfig(): StepContextConfig {
    return {
      aiClient: this.config.aiClient,
      agentPort: this.config.agentPort,
      workflowPort: this.config.workflowPort,
      runStore: this.config.runStore,
      schemaCache: this.config.schemaCache,
      logger: this.logger,
    };
  }
}
