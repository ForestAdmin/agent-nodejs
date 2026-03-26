import type { AgentPort } from '../ports/agent-port';
import type { Logger } from '../ports/logger-port';
import type { RunStore } from '../ports/run-store';
import type { WorkflowPort } from '../ports/workflow-port';
import type SchemaCache from '../schema-cache';
import type {
  ExecutionContext,
  IStepExecutor,
  PendingStepExecution,
  StepExecutionResult,
} from '../types/execution';
import type {
  ConditionStepDefinition,
  McpTaskStepDefinition,
  RecordTaskStepDefinition,
} from '../types/step-definition';
import type { AiClient, RemoteTool } from '@forestadmin/ai-proxy';

import { StepStateError, causeMessage } from '../errors';
import ConditionStepExecutor from './condition-step-executor';
import LoadRelatedRecordStepExecutor from './load-related-record-step-executor';
import McpTaskStepExecutor from './mcp-task-step-executor';
import ReadRecordStepExecutor from './read-record-step-executor';
import TriggerRecordActionStepExecutor from './trigger-record-action-step-executor';
import UpdateRecordStepExecutor from './update-record-step-executor';
import { StepType } from '../types/step-definition';
import { stepTypeToOutcomeType } from '../types/step-outcome';

export interface StepContextConfig {
  aiClient: AiClient;
  agentPort: AgentPort;
  workflowPort: WorkflowPort;
  runStore: RunStore;
  schemaCache: SchemaCache;
  logger: Logger;
}

export default class StepExecutorFactory {
  static async create(
    step: PendingStepExecution,
    contextConfig: StepContextConfig,
    loadTools: () => Promise<RemoteTool[]>,
  ): Promise<IStepExecutor> {
    try {
      const context = StepExecutorFactory.buildContext(step, contextConfig);

      switch (step.stepDefinition.type) {
        case StepType.Condition:
          return new ConditionStepExecutor(context as ExecutionContext<ConditionStepDefinition>);
        case StepType.ReadRecord:
          return new ReadRecordStepExecutor(context as ExecutionContext<RecordTaskStepDefinition>);
        case StepType.UpdateRecord:
          return new UpdateRecordStepExecutor(
            context as ExecutionContext<RecordTaskStepDefinition>,
          );
        case StepType.TriggerAction:
          return new TriggerRecordActionStepExecutor(
            context as ExecutionContext<RecordTaskStepDefinition>,
          );
        case StepType.LoadRelatedRecord:
          return new LoadRelatedRecordStepExecutor(
            context as ExecutionContext<RecordTaskStepDefinition>,
          );
        case StepType.McpTask:
          return new McpTaskStepExecutor(
            context as ExecutionContext<McpTaskStepDefinition>,
            await loadTools(),
          );
        default:
          throw new StepStateError(
            `Unknown step type: ${(step.stepDefinition as { type: string }).type}`,
          );
      }
    } catch (error) {
      contextConfig.logger.error('Step execution failed unexpectedly', {
        runId: step.runId,
        stepId: step.stepId,
        stepIndex: step.stepIndex,
        error: error instanceof Error ? error.message : String(error),
        cause: causeMessage(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      return {
        execute: async (): Promise<StepExecutionResult> => ({
          stepOutcome: {
            type: stepTypeToOutcomeType(step.stepDefinition.type),
            stepId: step.stepId,
            stepIndex: step.stepIndex,
            status: 'error',
            error: 'An unexpected error occurred.',
          },
        }),
      };
    }
  }

  private static buildContext(
    step: PendingStepExecution,
    cfg: StepContextConfig,
  ): ExecutionContext {
    return {
      ...step,
      model: cfg.aiClient.getModel(step.stepDefinition.aiConfigName),
      agentPort: cfg.agentPort,
      workflowPort: cfg.workflowPort,
      runStore: cfg.runStore,
      schemaCache: cfg.schemaCache,
      logger: cfg.logger,
    };
  }
}
