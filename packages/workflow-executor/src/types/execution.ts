/** @draft Types derived from the workflow-executor spec -- subject to change. */

import type { RecordRef } from './record';
import type { StepDefinition } from './step-definition';
import type { StepOutcome } from './step-outcome';
import type { AgentPort } from '../ports/agent-port';
import type { RunStore } from '../ports/run-store';
import type { WorkflowPort } from '../ports/workflow-port';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

export interface Step {
  stepDefinition: StepDefinition;
  stepOutcome: StepOutcome;
}

export interface PendingStepExecution {
  readonly runId: string;
  readonly stepId: string;
  readonly stepIndex: number;
  readonly baseRecordRef: RecordRef;
  readonly stepDefinition: StepDefinition;
  readonly previousSteps: ReadonlyArray<Step>;
  readonly userConfirmed?: boolean;
}

export interface StepExecutionResult {
  stepOutcome: StepOutcome;
}

export interface ExecutionContext<TStep extends StepDefinition = StepDefinition> {
  readonly runId: string;
  readonly stepId: string;
  readonly stepIndex: number;
  readonly baseRecordRef: RecordRef;
  readonly stepDefinition: TStep;
  readonly model: BaseChatModel;
  readonly agentPort: AgentPort;
  readonly workflowPort: WorkflowPort;
  readonly runStore: RunStore;
  readonly previousSteps: ReadonlyArray<Readonly<Step>>;
  readonly remoteTools: readonly unknown[];
  readonly userConfirmed?: boolean;
}
