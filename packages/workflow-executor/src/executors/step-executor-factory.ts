import type { ActivityLogPort } from '../ports/activity-log-port';
import type { AgentPort } from '../ports/agent-port';
import type { AiModelPort } from '../ports/ai-model-port';
import type { Logger } from '../ports/logger-port';
import type { RunStore } from '../ports/run-store';
import type { WorkflowPort } from '../ports/workflow-port';
import type { FetchRemoteToolsResult } from '../remote-tool-fetcher';
import type SchemaCache from '../schema-cache';
import type {
  AvailableStepExecution,
  ExecutionContext,
  IStepExecutor,
  StepExecutionResult,
} from '../types/execution-context';
import type {
  ConditionStepDefinition,
  GuidanceStepDefinition,
  LoadRelatedRecordStepDefinition,
  McpStepDefinition,
  ReadRecordStepDefinition,
  TriggerActionStepDefinition,
  UpdateRecordStepDefinition,
} from '../types/validated/step-definition';

import {
  StepStateError,
  WorkflowExecutorError,
  causeMessage,
  extractErrorMessage,
} from '../errors';
import SchemaResolver from '../schema-resolver';
import ActivityLog from './activity-log';
import AgentWithLog from './agent-with-log';
import ConditionStepExecutor from './condition-step-executor';
import GuidanceStepExecutor from './guidance-step-executor';
import LoadRelatedRecordStepExecutor from './load-related-record-step-executor';
import McpStepExecutor from './mcp-step-executor';
import ReadRecordStepExecutor from './read-record-step-executor';
import TriggerRecordActionStepExecutor from './trigger-record-action-step-executor';
import UpdateRecordStepExecutor from './update-record-step-executor';
import { StepType } from '../types/validated/step-definition';
import { stepTypeToOutcomeType } from '../types/validated/step-outcome';

export interface StepContextConfig {
  aiModelPort: AiModelPort;
  agentPort: AgentPort;
  workflowPort: WorkflowPort;
  runStore: RunStore;
  schemaCache: SchemaCache;
  logger: Logger;
  stepTimeoutS?: number;
  aiInvokeTimeoutS?: number;
}

export default class StepExecutorFactory {
  static async create(
    step: AvailableStepExecution,
    contextConfig: StepContextConfig,
    activityLogPort: ActivityLogPort,
    fetchRemoteTools: (mcpServerId: string) => Promise<FetchRemoteToolsResult>,
    incomingPendingData?: unknown,
  ): Promise<IStepExecutor> {
    try {
      const context = StepExecutorFactory.buildContext(
        step,
        contextConfig,
        activityLogPort,
        incomingPendingData,
      );

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

        case StepType.Mcp: {
          const mcpContext = context as ExecutionContext<McpStepDefinition>;
          const { tools, mcpServerName } = await fetchRemoteTools(
            mcpContext.stepDefinition.mcpServerId,
          );

          return new McpStepExecutor(mcpContext, tools, mcpServerName);
        }

        case StepType.Guidance:
          return new GuidanceStepExecutor(context as ExecutionContext<GuidanceStepDefinition>);
        default:
          throw new StepStateError(
            `Unknown step type: ${(step.stepDefinition as { type: string }).type}`,
          );
      }
    } catch (error) {
      contextConfig.logger('Error', 'Step execution failed unexpectedly', {
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
            error:
              error instanceof WorkflowExecutorError
                ? error.userMessage
                : 'An unexpected error occurred.',
          },
        }),
      };
    }
  }

  private static buildContext(
    step: AvailableStepExecution,
    cfg: StepContextConfig,
    activityLogPort: ActivityLogPort,
    incomingPendingData?: unknown,
  ): ExecutionContext {
    const schemaResolver = new SchemaResolver(
      cfg.schemaCache,
      cfg.workflowPort,
      step.runId,
      step.user.renderingId,
    );
    const activityLog = new ActivityLog(activityLogPort, step.user);

    return {
      runId: step.runId,
      stepId: step.stepId,
      stepIndex: step.stepIndex,
      collectionId: step.collectionId,
      baseRecordRef: step.baseRecordRef,
      stepDefinition: step.stepDefinition,
      previousSteps: step.previousSteps,
      user: step.user,
      model: cfg.aiModelPort.getModel(step.stepDefinition.aiConfigName),
      agent: new AgentWithLog({
        agentPort: cfg.agentPort,
        schemaResolver,
        user: step.user,
        activityLog,
      }),
      activityLog,
      runStore: cfg.runStore,
      schemaResolver,
      logger: cfg.logger,
      incomingPendingData,
      stepTimeoutS: cfg.stepTimeoutS,
      aiInvokeTimeoutS: cfg.aiInvokeTimeoutS,
    };
  }
}
