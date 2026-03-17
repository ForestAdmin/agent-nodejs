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
  readonly step: StepDefinition;
  readonly stepHistory: StepHistory;
  readonly previousSteps: ReadonlyArray<StepRecord>;
  readonly availableRecords: ReadonlyArray<RecordRef>;
  readonly userInput?: UserInput;
}

export interface StepExecutionResult {
  stepHistory: StepHistory;
}

export interface ExecutionContext {
  readonly runId: string;
  readonly model: BaseChatModel;
  readonly agentPort: AgentPort;
  readonly workflowPort: WorkflowPort;
  readonly runStore: RunStore;
  readonly history: ReadonlyArray<Readonly<StepRecord>>;
  readonly remoteTools: readonly unknown[];
}
