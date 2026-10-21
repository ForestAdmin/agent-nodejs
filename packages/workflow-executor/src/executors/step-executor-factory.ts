import type { PerRecordSource } from './per-record-step-executor';
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
  RunControl,
  StepExecutionResult,
} from '../types/execution-context';
import type { Step } from '../types/validated/execution';
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
  OAuthReauthRequiredError,
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
import PerRecordStepExecutor from './per-record-step-executor';
import ReadRecordStepExecutor from './read-record-step-executor';
import { findPinnedLoadStep } from './record-step-executor';
import TriggerRecordActionStepExecutor from './trigger-record-action-step-executor';
import UpdateRecordStepExecutor from './update-record-step-executor';
import { StepType, WORKFLOW_START_STEP_ID } from '../types/validated/step-definition';
import { stepTypeToOutcomeType } from '../types/validated/step-outcome';

export type { RunControl };

// The record steps that run once per record when their source chain starts at a Multiple step.
const PER_RECORD_STEP_TYPES = [
  StepType.ReadRecord,
  StepType.UpdateRecord,
  StepType.TriggerAction,
  StepType.LoadRelatedRecord,
];

// A step runs once per record when a Load Related Record set to Multiple sits on its source chain.
function findPerRecordSource(step: AvailableStepExecution): PerRecordSource | null {
  if (!PER_RECORD_STEP_TYPES.includes(step.stepDefinition.type)) return null;

  const pinned = step.stepDefinition as { preRecordedArgs?: { selectedRecordStepId?: string } };
  let stepId = pinned.preRecordedArgs?.selectedRecordStepId;
  let direct: Step | undefined;
  const visited = new Set<string>();

  while (stepId !== undefined && stepId !== WORKFLOW_START_STEP_ID && !visited.has(stepId)) {
    visited.add(stepId);
    // The same lookup the record executor reads its source with, so both agree on the step.
    const source = findPinnedLoadStep(
      step.previousSteps,
      stepId,
      step.callScope?.currentFrameStepIndexes,
    );
    if (!source) return null;

    direct ??= source;
    const sourceArgs = (source.stepDefinition as LoadRelatedRecordStepDefinition).preRecordedArgs;
    if (sourceArgs?.multiple === true) return { root: source, direct };

    stepId = sourceArgs?.selectedRecordStepId;
  }

  return null;
}

function createRecordExecutor(context: ExecutionContext): IStepExecutor {
  switch (context.stepDefinition.type) {
    case StepType.ReadRecord:
      return new ReadRecordStepExecutor(context as ExecutionContext<ReadRecordStepDefinition>);
    case StepType.UpdateRecord:
      return new UpdateRecordStepExecutor(context as ExecutionContext<UpdateRecordStepDefinition>);
    case StepType.TriggerAction:
      return new TriggerRecordActionStepExecutor(
        context as ExecutionContext<TriggerActionStepDefinition>,
      );
    default:
      return new LoadRelatedRecordStepExecutor(
        context as ExecutionContext<LoadRelatedRecordStepDefinition>,
      );
  }
}

export interface StepContextConfig {
  aiModelPort: AiModelPort;
  agentPort: AgentPort;
  workflowPort: WorkflowPort;
  runStore: RunStore;
  schemaCache: SchemaCache;
  logger: Logger;
  stepTimeoutS?: number;
  aiInvokeTimeoutS?: number;
  runControl?: RunControl;
}

export default class StepExecutorFactory {
  static async create(
    step: AvailableStepExecution,
    contextConfig: StepContextConfig,
    activityLogPort: ActivityLogPort,
    fetchRemoteTools: (mcpServerId: string, userId: number) => Promise<FetchRemoteToolsResult>,
    incomingPendingData?: unknown,
    forestServerToken?: string,
  ): Promise<IStepExecutor> {
    try {
      const context = StepExecutorFactory.buildContext(
        step,
        contextConfig,
        activityLogPort,
        incomingPendingData,
        forestServerToken,
      );
      const perRecordSource = findPerRecordSource(step);

      if (perRecordSource) {
        return new PerRecordStepExecutor(context, perRecordSource, createRecordExecutor);
      }

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
          const { tools, mcpServerName, reloadWithFreshAuth } = await fetchRemoteTools(
            mcpContext.stepDefinition.mcpServerId,
            step.user.id,
          );

          return new McpStepExecutor(mcpContext, tools, mcpServerName, reloadWithFreshAuth);
        }

        case StepType.Guidance:
          return new GuidanceStepExecutor(context as ExecutionContext<GuidanceStepDefinition>);
        default:
          throw new StepStateError(
            `Unknown step type: ${(step.stepDefinition as { type: string }).type}`,
          );
      }
    } catch (error) {
      // Re-auth required while loading tools is an expected pause, not a failure: emit awaiting-input
      // with the typed reason so the user can reconnect, rather than erroring the step.
      if (error instanceof OAuthReauthRequiredError) {
        contextConfig.logger('Info', 'MCP step paused for OAuth re-authentication', {
          runId: step.runId,
          stepId: step.stepId,
          stepIndex: step.stepIndex,
          awaitingInputReason: error.awaitingInputReason,
        });

        return {
          execute: async (): Promise<StepExecutionResult> => ({
            stepOutcome: {
              type: 'mcp',
              stepId: step.stepId,
              stepIndex: step.stepIndex,
              status: 'awaiting-input',
              awaitingInputReason: error.awaitingInputReason,
            },
          }),
        };
      }

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
    forestServerToken?: string,
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
      timezone: step.timezone,
      callScope: step.callScope,
      model: cfg.aiModelPort.getModel({
        aiConfigName: step.stepDefinition.aiConfigName,
        userId: step.user.id,
      }),
      agent: new AgentWithLog({
        agentPort: cfg.agentPort,
        schemaResolver,
        user: step.user,
        activityLog,
        forestServerToken,
      }),
      activityLog,
      runStore: cfg.runStore,
      schemaResolver,
      logger: cfg.logger,
      incomingPendingData,
      stepTimeoutS: cfg.stepTimeoutS,
      aiInvokeTimeoutS: cfg.aiInvokeTimeoutS,
      runControl: cfg.runControl,
    };
  }
}
