import type { PerRecordSource } from './per-record-step-executor';
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
import type { StepExecutionData } from '../types/step-execution-data';
import type { RecordRef } from '../types/validated/collection';
import type { CallScope, Step } from '../types/validated/execution';
import type {
  ConditionStepDefinition,
  GuidanceStepDefinition,
  LoadRelatedRecordStepDefinition,
  McpStepDefinition,
  ReadRecordStepDefinition,
  TriggerActionStepDefinition,
  UpdateRecordStepDefinition,
} from '../types/validated/step-definition';
import type { ActivityLogConfig } from '@forestadmin/agent-client';
import type { ActivityLogWorkflow } from '@forestadmin/forestadmin-client';

import { ActivityLogSource } from '@forestadmin/agent-client';

import {
  ApprovalOutcomesPerRecordError,
  CallRecordNotLoadedError,
  OAuthReauthRequiredError,
  SourceRecordMissingError,
  SourceRecordStepNotReachedError,
  SourceRunsOncePerRecordError,
  StepStateError,
  WorkflowExecutorError,
  causeMessage,
  extractErrorMessage,
  toErrorOutcome,
} from '../errors';
import SchemaResolver from '../schema-resolver';
import AgentWithLog from './agent-with-log';
import { findStepExecution } from './base-step-executor';
import CallRecordRunStore from './call-record-run-store';
import ConditionStepExecutor from './condition-step-executor';
import GuidanceStepExecutor from './guidance-step-executor';
import LoadRelatedRecordStepExecutor from './load-related-record-step-executor';
import McpStepExecutor from './mcp-step-executor';
import PerRecordStepExecutor from './per-record-step-executor';
import ReadRecordStepExecutor from './read-record-step-executor';
import { classifyMissingSourceRecord, findPinnedLoadStep } from './record-step-executor';
import SkippedForNoRecordStepExecutor from './skipped-for-no-record-step-executor';
import TriggerRecordActionStepExecutor from './trigger-record-action-step-executor';
import UpdateRecordStepExecutor from './update-record-step-executor';
import { isPerRecordExecution, isSkippedForNoRecord } from '../types/step-execution-data';
import { StepType, WORKFLOW_START_STEP_ID } from '../types/validated/step-definition';
import { stepTypeToOutcomeType } from '../types/validated/step-outcome';

export type { RunControl };

type RecordCall = NonNullable<CallScope['recordCalls']>[number];

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

// A load counts as empty once it loaded no record: none found, every candidate declined,
// "Continue without", or nothing saved at all, which is a load a person completed by hand, as the
// orchestrator reads it. A result outside the declared shape is an executor defect, never empty.
function loadedNothing(execution: StepExecutionData | undefined): boolean {
  if (!execution) return true;
  if (execution.type !== 'load-related-record' || isPerRecordExecution(execution)) return false;

  const result = execution.executionResult;
  if (result && 'records' in result) return result.records.length === 0;

  return classifyMissingSourceRecord(execution) !== undefined;
}

// The load a step could skip for (PRD-2399): the one it is pinned to, run in its frame. Decided
// without awaiting, so a step with none reaches its executor as soon as before.
function findSkipCandidate(step: AvailableStepExecution): Step | null {
  if (!PER_RECORD_STEP_TYPES.includes(step.stepDefinition.type)) return null;
  // A skip must take a branch, which only the operator can pick.
  if ((step.stepDefinition as TriggerActionStepDefinition).approvalOutcomes === true) return null;

  const pin = (step.stepDefinition as { preRecordedArgs?: { selectedRecordStepId?: string } })
    .preRecordedArgs?.selectedRecordStepId;
  if (pin === undefined || pin === WORKFLOW_START_STEP_ID) return null;

  return (
    findPinnedLoadStep(step.previousSteps, pin, step.callScope?.currentFrameStepIndexes) ?? null
  );
}

// The index of the empty load a step skips for: its own load, or the Multiple load its chain runs
// once per record of, set to Skip and empty, or the empty load an earlier skip carries down,
// whatever the loads in between are set to. Null runs the step as before.
async function findSkippingLoad(
  step: AvailableStepExecution,
  source: Step,
  perRecordSource: PerRecordSource | null,
  runStore: RunStore,
): Promise<number | null> {
  const executions = await runStore.getStepExecutions(step.runId);
  const direct = findStepExecution(source, executions);
  if (isSkippedForNoRecord(direct)) return direct.executionResult.emptySourceStepIndex;

  const load = perRecordSource?.root ?? source;
  const execution = perRecordSource ? findStepExecution(load, executions) : direct;
  if (isSkippedForNoRecord(execution)) return execution.executionResult.emptySourceStepIndex;

  const { ifNoRecords } =
    (load.stepDefinition as LoadRelatedRecordStepDefinition).preRecordedArgs ?? {};

  return ifNoRecords === 'skip' && loadedNothing(execution) ? load.stepOutcome.stepIndex : null;
}

// The record a call opened once per record runs on: its Multiple step's record at the call's
// position. Without it the step would see every record the calling workflow loaded, so it fails,
// naming what to fix: the Sub-workflow step's pin, or the records its Multiple step loaded.
function findCallRecord(
  step: AvailableStepExecution,
  call: RecordCall,
  executions: StepExecutionData[],
): RecordRef {
  const source = findPinnedLoadStep(
    step.previousSteps,
    call.selectedRecordStepId,
    call.pinnedFrameStepIndexes,
  );
  if (!source) throw new SourceRecordStepNotReachedError(call.selectedRecordStepId);

  const execution = findStepExecution(source, executions);
  const { title } = source.stepDefinition;
  if (isPerRecordExecution(execution)) throw new SourceRunsOncePerRecordError(title);

  const result = execution?.type === 'load-related-record' ? execution.executionResult : undefined;

  if (result && 'records' in result) {
    const record = result.records[call.recordIndex];
    if (!record) throw new CallRecordNotLoadedError(title);

    return record;
  }

  throw new SourceRecordMissingError(title, {
    errorKind: classifyMissingSourceRecord(execution),
    errorSourceStepIndex: source.stepOutcome.stepIndex,
  });
}

// Each enclosing call narrows what the calls inside it read, so a call nested in another record's
// call reads the outer workflow as the outer record sees it. Every record is read off one fetch.
async function scopeToRecordCalls(
  step: AvailableStepExecution,
  runStore: RunStore,
): Promise<RunStore> {
  const calls = step.callScope?.recordCalls;
  if (!calls) return runStore;

  const executions = await runStore.getStepExecutions(step.runId);

  return calls.reduce<RunStore>(
    (store, call) =>
      new CallRecordRunStore(store, findCallRecord(step, call, executions), call.startStepIndex),
    runStore,
  );
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
  forestServerUrl: string;
  stepTimeoutS?: number;
  aiInvokeTimeoutS?: number;
  runControl?: RunControl;
}

export default class StepExecutorFactory {
  static async create(
    step: AvailableStepExecution,
    contextConfig: StepContextConfig,
    fetchRemoteTools: (mcpServerId: string, userId: number) => Promise<FetchRemoteToolsResult>,
    incomingPendingData?: unknown,
    forestServerToken?: string,
  ): Promise<IStepExecutor> {
    try {
      const builtContext = StepExecutorFactory.buildContext(
        step,
        contextConfig,
        incomingPendingData,
        forestServerToken,
      );
      const context: ExecutionContext = {
        ...builtContext,
        runStore: await scopeToRecordCalls(step, builtContext.runStore),
      };
      const perRecordSource = findPerRecordSource(step);
      const skipCandidate = findSkipCandidate(step);
      const emptySourceStepIndex = skipCandidate
        ? await findSkippingLoad(step, skipCandidate, perRecordSource, context.runStore)
        : null;

      if (emptySourceStepIndex !== null) {
        return new SkippedForNoRecordStepExecutor(context, emptySourceStepIndex);
      }

      if (perRecordSource) {
        if ((step.stepDefinition as TriggerActionStepDefinition).approvalOutcomes === true) {
          throw new ApprovalOutcomesPerRecordError();
        }

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
            ...(error instanceof WorkflowExecutorError
              ? toErrorOutcome(error)
              : { error: 'An unexpected error occurred.' }),
          },
        }),
      };
    }
  }

  // No name, no workflow: the activity-log route rejects a workflow without one. An untitled step is
  // named by its id, as the orchestrator names it in its own workflow logs.
  private static toActivityLogWorkflow(
    step: AvailableStepExecution,
  ): ActivityLogWorkflow | undefined {
    if (!step.workflowName) return undefined;

    return {
      runId: step.runId,
      name: step.workflowName,
      stepName: step.stepDefinition.title || step.stepId,
    };
  }

  private static buildContext(
    step: AvailableStepExecution,
    cfg: StepContextConfig,
    incomingPendingData?: unknown,
    forestServerToken?: string,
  ): ExecutionContext {
    const schemaResolver = new SchemaResolver(
      cfg.schemaCache,
      cfg.workflowPort,
      step.runId,
      step.user.renderingId,
    );
    const activityLog: ActivityLogConfig = {
      forestServer: {
        serverUrl: cfg.forestServerUrl,
        serverToken: () => {
          if (!forestServerToken) throw new Error('The run carries no Forest server token');

          return forestServerToken;
        },
        renderingId: step.user.renderingId,
      },
      activityLog: {
        source: ActivityLogSource.WorkflowExecutor,
        logger: cfg.logger,
        workflow: StepExecutorFactory.toActivityLogWorkflow(step),
        collectionIdOf: async collectionName =>
          (await schemaResolver.resolve(collectionName)).collectionId,
        retryCreation: true,
      },
    };

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
      approvalRequests: step.approvalRequests,
      subWorkflowEnds: step.subWorkflowEnds,
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
