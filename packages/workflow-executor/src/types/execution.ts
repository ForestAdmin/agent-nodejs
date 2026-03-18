/** @draft Types derived from the workflow-executor spec -- subject to change. */

import type { RecordRef } from './record';
import type { StepDefinition } from './step-definition';
import type { StepHistory } from './step-history';
import type { AgentPort } from '../ports/agent-port';
import type { RunStore } from '../ports/run-store';
import type { WorkflowPort } from '../ports/workflow-port';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

export interface StepRecord {
  step: StepDefinition;
  stepHistory: StepHistory;
}

export type UserInput = { type: 'confirmation'; confirmed: boolean };

export interface PendingStepExecution {
  readonly runId: string;
  readonly baseRecord: RecordRef;
  readonly currentStep: StepRecord;
  readonly previousSteps: ReadonlyArray<StepRecord>;
  readonly userInput?: UserInput;
}

export interface StepExecutionResult {
  stepHistory: StepHistory;
}

export interface ExecutionContext<
  TStep extends StepDefinition = StepDefinition,
  THistory extends StepHistory = StepHistory,
> {
  readonly runId: string;
  readonly baseRecord: RecordRef;
  readonly step: TStep;
  readonly stepHistory: THistory;
  readonly model: BaseChatModel;
  readonly agentPort: AgentPort;
  readonly workflowPort: WorkflowPort;
  readonly runStore: RunStore;
  readonly history: ReadonlyArray<Readonly<StepRecord>>;
  readonly remoteTools: readonly unknown[];
}
