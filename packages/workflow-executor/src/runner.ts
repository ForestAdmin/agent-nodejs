import type { StepContextConfig } from './executors/step-executor-factory';
import type { AgentPort } from './ports/agent-port';
import type { Logger } from './ports/logger-port';
import type { RunStore } from './ports/run-store';
import type { McpConfiguration, WorkflowPort } from './ports/workflow-port';
import type { PendingStepExecution, StepExecutionResult, StepUser } from './types/execution';
import type { CollectionSchema } from './types/record';
import type { StepExecutionData } from './types/step-execution-data';
import type { AiClient, RemoteTool } from '@forestadmin/ai-proxy';

import jsonwebtoken from 'jsonwebtoken';

import ConsoleLogger from './adapters/console-logger';
import {
  InvalidPendingDataError,
  PendingDataNotFoundError,
  RunNotFoundError,
  causeMessage,
} from './errors';
import StepExecutorFactory from './executors/step-executor-factory';
import ExecutorHttpServer from './http/executor-http-server';
import patchBodySchemas from './pending-data-validators';
import validateSecrets from './validate-secrets';

export interface CreateAgentPortParams {
  userToken: string;
  collectionSchemas: Record<string, CollectionSchema>;
}

export interface RunnerConfig {
  createAgentPort: (params: CreateAgentPortParams) => AgentPort;
  workflowPort: WorkflowPort;
  runStore: RunStore;
  pollingIntervalMs: number;
  aiClient: AiClient;
  envSecret: string;
  authSecret: string;
  logger?: Logger;
  httpPort?: number;
}

export default class Runner {
  private readonly config: RunnerConfig;
  private httpServer: ExecutorHttpServer | null = null;
  private pollingTimer: NodeJS.Timeout | null = null;
  private readonly inFlightSteps = new Set<string>();
  private isRunning = false;
  private readonly logger: Logger;

  private static once<T>(fn: () => Promise<T>): () => Promise<T> {
    let cached: Promise<T> | undefined;

    return () => {
      cached ??= fn();

      return cached;
    };
  }

  private static stepKey(step: PendingStepExecution): string {
    return `${step.runId}:${step.stepId}`;
  }

  constructor(config: RunnerConfig) {
    this.config = config;
    this.logger = config.logger ?? new ConsoleLogger();
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    validateSecrets({ envSecret: this.config.envSecret, authSecret: this.config.authSecret });

    this.isRunning = true;

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
      throw error;
    }

    this.schedulePoll();
  }

  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.pollingTimer !== null) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }

    if (this.httpServer) {
      await this.httpServer.stop();
      this.httpServer = null;
    }

    await Promise.allSettled([
      this.config.aiClient.closeConnections(),
      this.config.runStore.close(this.logger),
    ]);

    // TODO: graceful drain of in-flight steps (out of scope PRD-223)
  }

  async getRunStepExecutions(runId: string): Promise<StepExecutionData[]> {
    return this.config.runStore.getStepExecutions(runId);
  }

  async patchPendingData(runId: string, stepIndex: number, body: unknown): Promise<void> {
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

  async triggerPoll(runId: string): Promise<void> {
    const schemaCache = new Map<string, CollectionSchema>();
    const step = await this.config.workflowPort.getPendingStepExecutionsForRun(runId);

    if (!step) throw new RunNotFoundError(runId);

    if (this.inFlightSteps.has(Runner.stepKey(step))) return;

    const loadTools = Runner.once(() => this.fetchRemoteTools());
    await this.executeStep(step, loadTools, schemaCache);
  }

  private schedulePoll(): void {
    if (!this.isRunning) return;
    this.pollingTimer = setTimeout(() => this.runPollCycle(), this.config.pollingIntervalMs);
  }

  private async runPollCycle(): Promise<void> {
    try {
      const schemaCache = new Map<string, CollectionSchema>();
      const steps = await this.config.workflowPort.getPendingStepExecutions();
      const pending = steps.filter(s => !this.inFlightSteps.has(Runner.stepKey(s)));
      const loadTools = Runner.once(() => this.fetchRemoteTools());
      await Promise.allSettled(pending.map(s => this.executeStep(s, loadTools, schemaCache)));
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

  private async executeStep(
    step: PendingStepExecution,
    loadTools: () => Promise<RemoteTool[]>,
    schemaCache: Map<string, CollectionSchema>,
  ): Promise<void> {
    const key = Runner.stepKey(step);
    this.inFlightSteps.add(key);

    let result: StepExecutionResult;

    try {
      const userToken = this.forgeUserToken(step.user);
      const contextConfig = this.buildContextConfig(schemaCache, userToken);
      const executor = await StepExecutorFactory.create(step, contextConfig, loadTools);
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

  private forgeUserToken(user: StepUser): string {
    return jsonwebtoken.sign({ ...user }, this.config.authSecret, { expiresIn: '1h' });
  }

  private buildContextConfig(
    schemaCache: Map<string, CollectionSchema>,
    userToken: string,
  ): StepContextConfig {
    return {
      aiClient: this.config.aiClient,
      agentPort: this.config.createAgentPort({
        userToken,
        collectionSchemas: Object.fromEntries(schemaCache),
      }),
      workflowPort: this.config.workflowPort,
      runStore: this.config.runStore,
      schemaCache,
      logger: this.logger,
    };
  }
}
