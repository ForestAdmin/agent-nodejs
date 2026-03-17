/** @draft Types derived from the workflow-executor spec -- subject to change. */

import type { RecordData } from './record';
import type { StepDefinition } from './step-definition';
import type { StepHistory } from './step-history';
import type { AgentPort } from '../ports/agent-port';
import type { RunStore } from '../ports/run-store';
import type { WorkflowPort } from '../ports/workflow-port';

export type UserInput = { type: 'confirmation'; confirmed: boolean };

export interface PendingStepExecution {
  runId: string;
  step: StepDefinition;
  stepHistory: StepHistory;
  previousSteps: StepHistory[];
  availableRecords: RecordData[];
  userInput?: UserInput;
}

export interface StepExecutionResult {
  stepHistory: StepHistory;
  newAvailableRecord?: RecordData;
}

export interface ExecutionContext {
  runId: string;
  /** Placeholder -- will be typed as AiConfiguration from @forestadmin/ai-proxy once added as dependency. */
  model: unknown;
  agentPort: AgentPort;
  workflowPort: WorkflowPort;
  runStore: RunStore;
  history: StepHistory[];
  /** Placeholder -- will be typed as RemoteTool[] (to be re-exported from @forestadmin/ai-proxy). */
  remoteTools: unknown[];
}
