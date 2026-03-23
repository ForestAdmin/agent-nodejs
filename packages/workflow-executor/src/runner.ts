import type { AgentPort } from './ports/agent-port';
import type { Logger } from './ports/logger-port';
import type { RunStore } from './ports/run-store';
import type { McpConfiguration, WorkflowPort } from './ports/workflow-port';
import type { ExecutionContext, PendingStepExecution } from './types/execution';
import type { StepOutcome } from './types/step-outcome';
import type { AiClient, RemoteTool } from '@forestadmin/ai-proxy';

import ConsoleLogger from './adapters/console-logger';
import StepExecutorFactory from './executors/step-executor-factory';
import ExecutorHttpServer from './http/executor-http-server';
import { StepType } from './types/step-definition';

export interface RunnerConfig {
  agentPort: AgentPort;
  workflowPort: WorkflowPort;
  runStore: RunStore;
  pollingIntervalMs: number;
  aiClient: AiClient;
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

  private static stepOutcomeType(
    step: PendingStepExecution,
  ): 'condition' | 'record-task' | 'mcp-task' {
    if (step.stepDefinition.type === StepType.Condition) return 'condition';
    if (step.stepDefinition.type === StepType.McpTask) return 'mcp-task';

    return 'record-task';
  }

  private static causeMessage(error: unknown): string | undefined {
    const { cause } = error as { cause?: unknown };

    return cause instanceof Error ? cause.message : undefined;
  }

  constructor(config: RunnerConfig) {
    this.config = config;
    this.logger = config.logger ?? new ConsoleLogger();
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      if (this.config.httpPort !== undefined && !this.httpServer) {
        const server = new ExecutorHttpServer({
          port: this.config.httpPort,
          runStore: this.config.runStore,
          runner: this,
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

    await this.config.aiClient.closeConnections();

    // TODO: graceful drain of in-flight steps (out of scope PRD-223)
  }

  async triggerPoll(runId: string): Promise<void> {
    const steps = await this.config.workflowPort.getPendingStepExecutions();
    const pending = steps.filter(
      s => s.runId === runId && !this.inFlightSteps.has(Runner.stepKey(s)),
    );
    const loadTools = Runner.once(() => this.fetchRemoteTools());
    await Promise.allSettled(pending.map(s => this.executeStep(s, loadTools)));
  }

  private schedulePoll(): void {
    if (!this.isRunning) return;
    this.pollingTimer = setTimeout(() => this.runPollCycle(), this.config.pollingIntervalMs);
  }

  private async runPollCycle(): Promise<void> {
    try {
      const steps = await this.config.workflowPort.getPendingStepExecutions();
      const pending = steps.filter(s => !this.inFlightSteps.has(Runner.stepKey(s)));
      const loadTools = Runner.once(() => this.fetchRemoteTools());
      await Promise.allSettled(pending.map(s => this.executeStep(s, loadTools)));
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
  ): Promise<void> {
    const key = Runner.stepKey(step);
    this.inFlightSteps.add(key);

    let stepOutcome: StepOutcome;

    try {
      const context = this.buildContext(step);
      const executor = await StepExecutorFactory.create(step, context, loadTools);
      ({ stepOutcome } = await executor.execute());
    } catch (error) {
      this.logger.error('Step execution failed unexpectedly', {
        runId: step.runId,
        stepId: step.stepId,
        stepIndex: step.stepIndex,
        error: error instanceof Error ? error.message : String(error),
        cause: Runner.causeMessage(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      stepOutcome = {
        type: Runner.stepOutcomeType(step),
        stepId: step.stepId,
        stepIndex: step.stepIndex,
        status: 'error',
        error: 'An unexpected error occurred.',
      } as StepOutcome;
    } finally {
      this.inFlightSteps.delete(key);
    }

    try {
      await this.config.workflowPort.updateStepExecution(step.runId, stepOutcome);
    } catch (error) {
      this.logger.error('Failed to report step outcome', {
        runId: step.runId,
        stepId: step.stepId,
        stepIndex: step.stepIndex,
        error: error instanceof Error ? error.message : String(error),
        cause: Runner.causeMessage(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  private buildContext(step: PendingStepExecution): ExecutionContext {
    return {
      ...step,
      model: this.config.aiClient.getModel(step.stepDefinition.aiConfigName),
      agentPort: this.config.agentPort,
      workflowPort: this.config.workflowPort,
      runStore: this.config.runStore,
      logger: this.logger,
    };
  }
}
