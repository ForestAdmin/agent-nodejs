/**
 * Local mirror of the orchestrator's contract.
 * See forestadmin-server/packages/private-api/src/domain/workflow-orchestrator/types.ts
 *
 * Contains both step-level types (workflow step variants) and the run envelope
 * (HydratedWorkflowRun + user profile + step history).
 */

export interface ServerWorkflowTransition {
  stepId: string;
  buttonText: string | null;
  buttonColor?: string | null;
  answer?: string;
}

export type ServerTaskType =
  | 'guideline'
  | 'trigger-action'
  | 'get-data'
  | 'update-data'
  | 'load-related-record'
  | 'mcp-server';

export interface ServerWorkflowTask {
  type: 'task';
  taskType: ServerTaskType;
  title: string;
  prompt: string;
  allowedTools?: string[];
  mcpServerId?: string;
  automaticExecution?: boolean;
  automaticCompletion?: boolean;
  outgoing: ServerWorkflowTransition;
}

export interface ServerWorkflowCondition {
  type: 'condition';
  title: string;
  prompt: string;
  outgoing: ServerWorkflowTransition[];
  automaticExecution?: boolean;
}

export interface ServerWorkflowEnd {
  type: 'end';
  title: string;
  prompt?: string;
}

export interface ServerWorkflowEscalation {
  type: 'escalation';
  title: string;
  prompt: string;
  outgoing: ServerWorkflowTransition;
  inboxId: string | null;
}

export interface ServerStartSubWorkflow {
  type: 'start-sub-workflow';
  title: string;
  prompt: string;
  outgoing: ServerWorkflowTransition;
  workflowId: string;
}

export interface ServerCloseSubWorkflow {
  type: 'close-sub-workflow';
  title?: string;
  outgoing: ServerWorkflowTransition;
  parentWorkflowId: string | null;
}

export type ServerWorkflowStep =
  | ServerWorkflowTask
  | ServerWorkflowCondition
  | ServerWorkflowEnd
  | ServerWorkflowEscalation
  | ServerStartSubWorkflow
  | ServerCloseSubWorkflow;

// --- Run envelope (returned by pending-run endpoints) ---

export interface ServerUserProfile {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  team: string | null;
  renderingId: number;
  role: string | null;
  permissionLevel: string | null;
  tags: Record<string, string>;
}

export interface ServerStepHistory {
  stepName: string;
  stepIndex: number;
  done: boolean;
  revised?: boolean;
  cancelled?: boolean;
  context?: Record<string, unknown>;
  stepDefinition: ServerWorkflowStep;
}

/** Possible workflow run states (mirror of the server enum). */
export type ServerWorkflowRunState =
  | 'pending'
  | 'running'
  | 'awaiting-input'
  | 'done'
  | 'cancelled'
  | 'failed';

export interface ServerHydratedWorkflowRun {
  id: number;
  workflowId: string;
  collectionId: string;
  collectionName: string | null;
  selectedRecordId: string;
  bpmnVersion: string;
  runState: ServerWorkflowRunState;
  workflowHistory: ServerStepHistory[];
  createdAt: string;
  updatedAt: string;
  userId: number;
  renderingId: number;
  lockedAt?: string | null;
  userProfile?: ServerUserProfile;
}

// --- Update step request (POST /api/workflow-orchestrator/update-step) ---

export interface ServerStepHistoryUpdate {
  isLoading?: boolean;
  done?: boolean;
  revised?: boolean;
  cancelled?: boolean;
  context?: Record<string, unknown>;
}

export interface ServerStepUpdate {
  stepIndex: number;
  attributes: ServerStepHistoryUpdate;
}

export type ServerExecutionStatus =
  | { type: 'success'; nextStepId?: string }
  | { type: 'error'; message: string }
  | { type: 'awaiting-input' };

export interface ServerUpdateStepRequest {
  runId: number;
  stepUpdate: ServerStepUpdate;
  executionStatus: ServerExecutionStatus;
}
