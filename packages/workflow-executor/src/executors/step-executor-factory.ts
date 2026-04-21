import type { ActivityLogPort } from '../ports/activity-log-port';
import type { AgentPort } from '../ports/agent-port';
import type { AiModelPort } from '../ports/ai-model-port';
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
  GuidanceStepDefinition,
  LoadRelatedRecordStepDefinition,
  McpStepDefinition,
  ReadRecordStepDefinition,
  TriggerActionStepDefinition,
  UpdateRecordStepDefinition,
} from '../types/step-definition';
import type { RemoteTool } from '@forestadmin/ai-proxy';

import { StepStateError, causeMessage, extractErrorMessage } from '../errors';
import ConditionStepExecutor from './condition-step-executor';
import GuidanceStepExecutor from './guidance-step-executor';
import LoadRelatedRecordStepExecutor from './load-related-record-step-executor';
import McpStepExecutor from './mcp-step-executor';
import ReadRecordStepExecutor from './read-record-step-executor';
import TriggerRecordActionStepExecutor from './trigger-record-action-step-executor';
import UpdateRecordStepExecutor from './update-record-step-executor';
import { StepType } from '../types/step-definition';
import { stepTypeToOutcomeType } from '../types/step-outcome';

export interface StepContextConfig {
  aiModelPort: AiModelPort;
  agentPort: AgentPort;
  workflowPort: WorkflowPort;
  runStore: RunStore;
  schemaCache: SchemaCache;
  logger: Logger;
  activityLogPort: ActivityLogPort;
  stepTimeoutMs?: number;
}

export default class StepExecutorFactory {
  static async create(
    step: PendingStepExecution,
    contextConfig: StepContextConfig,
    loadTools: () => Promise<RemoteTool[]>,
    incomingPendingData?: unknown,
  ): Promise<IStepExecutor> {
    try {
      const context = StepExecutorFactory.buildContext(step, contextConfig, incomingPendingData);

      switch (step.stepDefinition.type) {
        case StepType.Condition:
          return new ConditionStepExecutor(context as ExecutionContext<ConditionStepDefinition>);
        case StepType.ReadRecord:
          return new ReadRecordStepExecutor(context as ExecutionContext<ReadRecordStepDefinition>);
        case StepType.UpdateRecord:
          return new UpdateRecordStepExecutor(
            context as ExecutionContext<UpdateRecordStepDefinition>,
          );
        case StepType.TriggerAction:
          return new TriggerRecordActionStepExecutor(
            context as ExecutionContext<TriggerActionStepDefinition>,
          );
        case StepType.LoadRelatedRecord:
          return new LoadRelatedRecordStepExecutor(
            context as ExecutionContext<LoadRelatedRecordStepDefinition>,
          );
        case StepType.Mcp:
          return new McpStepExecutor(
            context as ExecutionContext<McpStepDefinition>,
            await loadTools(),
          );
        case StepType.Guidance:
          return new GuidanceStepExecutor(context as ExecutionContext<GuidanceStepDefinition>);
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
        error: extractErrorMessage(error),
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
    incomingPendingData?: unknown,
  ): ExecutionContext {
    return {
      ...step,
      model: cfg.aiModelPort.getModel(step.stepDefinition.aiConfigName),
      agentPort: cfg.agentPort,
      workflowPort: cfg.workflowPort,
      runStore: cfg.runStore,
      schemaCache: cfg.schemaCache,
      logger: cfg.logger,
      incomingPendingData,
      stepTimeoutMs: cfg.stepTimeoutMs,
      activityLogPort: cfg.activityLogPort,
    };
  }
}
