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

export enum ServerStepTypeEnum {
  Task = 'task',
  Condition = 'condition',
  End = 'end',
  Escalation = 'escalation',
  StartSubWorkflow = 'start-sub-workflow',
  CloseSubWorkflow = 'close-sub-workflow',
}

export enum ServerTaskTypeEnum {
  Guideline = 'guideline',
  TriggerAction = 'trigger-action',
  GetData = 'get-data',
  UpdateData = 'update-data',
  LoadRelatedRecord = 'load-related-record',
  McpServer = 'mcp-server',
}

export enum ServerStepExecutionTypeEnum {
  Manual = 'manual',
  AutomatedWithConfirmation = 'automated-with-confirmation',
  FullyAutomated = 'fully-automated',
}

interface ServerWorkflowStepBase {
  type: ServerStepTypeEnum;
  title: string;
  prompt?: string;
  executionType: ServerStepExecutionTypeEnum;
  automaticCompletion: boolean;
  outgoing: ServerWorkflowTransition[];
}

export interface ServerWorkflowTaskBase extends ServerWorkflowStepBase {
  type: ServerStepTypeEnum.Task;
  taskType: ServerTaskTypeEnum;
  isSubTask?: boolean;
  prompt: string;
  outgoing: [ServerWorkflowTransition];
}

export interface ServerWorkflowTaskGuideline extends ServerWorkflowTaskBase {
  taskType: ServerTaskTypeEnum.Guideline;
  executionType: ServerStepExecutionTypeEnum.Manual;
  completionType: 'simple' | 'user-input';
  inputType?: 'free-text';
  automaticCompletion: false;
}

interface ServerWorkflowTaskGetData extends ServerWorkflowTaskBase {
  taskType: ServerTaskTypeEnum.GetData;
  executionType: ServerStepExecutionTypeEnum.FullyAutomated;
}

interface ServerWorkflowTaskUpdateData extends ServerWorkflowTaskBase {
  taskType: ServerTaskTypeEnum.UpdateData;
  executionType:
    | ServerStepExecutionTypeEnum.FullyAutomated
    | ServerStepExecutionTypeEnum.AutomatedWithConfirmation;
}

interface ServerWorkflowTaskTriggerAction extends ServerWorkflowTaskBase {
  taskType: ServerTaskTypeEnum.TriggerAction;
  executionType:
    | ServerStepExecutionTypeEnum.FullyAutomated
    | ServerStepExecutionTypeEnum.AutomatedWithConfirmation;
}

interface ServerWorkflowTaskLoadRelatedRecord extends ServerWorkflowTaskBase {
  taskType: ServerTaskTypeEnum.LoadRelatedRecord;
  executionType:
    | ServerStepExecutionTypeEnum.FullyAutomated
    | ServerStepExecutionTypeEnum.AutomatedWithConfirmation;
  // Deterministic build-time config (PRD-471). Validated by the step-definition schema.
  preRecordedArgs?: { selectedRecordStepIndex?: number; relationName?: string };
}

export interface ServerWorkflowTaskMcpServer extends ServerWorkflowTaskBase {
  taskType: ServerTaskTypeEnum.McpServer;
  executionType:
    | ServerStepExecutionTypeEnum.FullyAutomated
    | ServerStepExecutionTypeEnum.AutomatedWithConfirmation;
  mcpServerId: string;
}

export type ServerWorkflowTask =
  | ServerWorkflowTaskGuideline
  | ServerWorkflowTaskGetData
  | ServerWorkflowTaskUpdateData
  | ServerWorkflowTaskTriggerAction
  | ServerWorkflowTaskLoadRelatedRecord
  | ServerWorkflowTaskMcpServer;

export interface ServerWorkflowEnd extends ServerWorkflowStepBase {
  type: ServerStepTypeEnum.End;
  executionType: ServerStepExecutionTypeEnum.Manual;
  automaticCompletion: false;
  outgoing: [];
}

export interface ServerWorkflowCondition extends ServerWorkflowStepBase {
  type: ServerStepTypeEnum.Condition;
  executionType: ServerStepExecutionTypeEnum.Manual | ServerStepExecutionTypeEnum.FullyAutomated;
  prompt: string;
  automaticCompletion: false;
}

export interface ServerWorkflowEscalation extends ServerWorkflowStepBase {
  type: ServerStepTypeEnum.Escalation;
  prompt: string;
  outgoing: [ServerWorkflowTransition];
  inboxId: string | null;
}

export interface ServerStartSubWorkflow extends ServerWorkflowStepBase {
  type: ServerStepTypeEnum.StartSubWorkflow;
  executionType: ServerStepExecutionTypeEnum.Manual;
  outgoing: [ServerWorkflowTransition];
  workflowId: string;
}

export interface ServerCloseSubWorkflow extends ServerWorkflowStepBase {
  type: ServerStepTypeEnum.CloseSubWorkflow;
  executionType: ServerStepExecutionTypeEnum.Manual;
  outgoing: [ServerWorkflowTransition];
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
  // Forwarded by the orchestrator so the executor can post activity logs on behalf of the user.
  serverToken: string;
}

export interface ServerStepHistory {
  stepName: string;
  stepIndex: number;
  done: boolean;
  revised?: boolean;
  cancelled?: boolean;
  // On a revision clone, the index of the step it copies — where that step's record lives.
  originalStepIndex?: number;
  context?: Record<string, unknown>;
  childrenWorkflowId?: string;
  stepDefinition: ServerWorkflowStep;
}

/** Mirror of the server's `WorkflowRunState` enum (workflow-run-model.ts). */
export type ServerWorkflowRunState = 'started' | 'pending' | 'loading' | 'aborted' | 'finished';

export interface ServerHydratedWorkflowRun {
  id: number;
  workflowId: string;
  collectionId: string;
  collectionName: string | null;
  selectedRecordId: string;
  bpmnVersion: string;
  runState: ServerWorkflowRunState;
  workflowHistory: ServerStepHistory[];
  /** Server types declare `Date`; Express serializes to ISO 8601 string on the wire. */
  createdAt: string;
  updatedAt: string;
  userId: number;
  renderingId: number;
  lockedAt?: string | null;
  userProfile: ServerUserProfile;
}

// --- Update step request (POST /api/workflow-orchestrator/update-step) ---

export interface ServerStepHistoryUpdate {
  /** Accepted by the server Joi schema; missing from the server TS type (server-side gap). */
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
  /** `nextStepId` is accepted by the server Joi schema; missing from the server TS type. */
  | { type: 'success'; nextStepId?: string }
  | { type: 'error'; message: string }
  | { type: 'awaiting-input' };

export interface ServerUpdateStepRequest {
  runId: number;
  stepUpdate: ServerStepUpdate;
  executionStatus: ServerExecutionStatus;
}
