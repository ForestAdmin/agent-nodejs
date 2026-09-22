/**
 * Local mirror of the orchestrator's contract.
 * See forestadmin-server/packages/private-api/src/domain/workflow-orchestrator/types.ts
 *
 * Contains both step-level types (workflow step variants) and the run envelope
 * (HydratedWorkflowRun + user profile + step history).
 */

import { z } from 'zod';

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
  // The orchestrator serializes missing BPMN attributes as null (DOM getAttribute), never omits.
  title: string | null;
  prompt?: string | null;
  executionType: ServerStepExecutionTypeEnum;
  automaticCompletion: boolean;
  outgoing: ServerWorkflowTransition[];
}

export interface ServerWorkflowTaskBase extends ServerWorkflowStepBase {
  type: ServerStepTypeEnum.Task;
  taskType: ServerTaskTypeEnum;
  isSubTask?: boolean;
  prompt: string | null;
  outgoing: [ServerWorkflowTransition];
}

export interface ServerWorkflowTaskGuideline extends ServerWorkflowTaskBase {
  taskType: ServerTaskTypeEnum.Guideline;
  // AI modes only for a user-input guidance; simple-completion is always Manual (parser-enforced).
  executionType: ServerStepExecutionTypeEnum;
  completionType: 'simple' | 'user-input';
  inputType?: 'free-text';
  automaticCompletion: false;
}

interface ServerWorkflowTaskGetData extends ServerWorkflowTaskBase {
  taskType: ServerTaskTypeEnum.GetData;
  executionType: ServerStepExecutionTypeEnum.FullyAutomated;
  preRecordedArgs?: { selectedRecordStepId?: string; fieldNames?: string[] };
}

interface ServerWorkflowTaskUpdateData extends ServerWorkflowTaskBase {
  taskType: ServerTaskTypeEnum.UpdateData;
  executionType:
    | ServerStepExecutionTypeEnum.FullyAutomated
    | ServerStepExecutionTypeEnum.AutomatedWithConfirmation;
  preRecordedArgs?: { selectedRecordStepId?: string; fieldName?: string; value?: unknown };
}

interface ServerWorkflowTaskTriggerAction extends ServerWorkflowTaskBase {
  taskType: ServerTaskTypeEnum.TriggerAction;
  // Manual is valid for a form-bearing action: pause for the user with no AI prefill.
  executionType:
    | ServerStepExecutionTypeEnum.Manual
    | ServerStepExecutionTypeEnum.FullyAutomated
    | ServerStepExecutionTypeEnum.AutomatedWithConfirmation;
  preRecordedArgs?: { selectedRecordStepId?: string; actionName?: string };
}

interface ServerWorkflowTaskLoadRelatedRecord extends ServerWorkflowTaskBase {
  taskType: ServerTaskTypeEnum.LoadRelatedRecord;
  executionType:
    | ServerStepExecutionTypeEnum.FullyAutomated
    | ServerStepExecutionTypeEnum.AutomatedWithConfirmation;
  // Validated by the step-definition schema.
  preRecordedArgs?: { selectedRecordStepId?: string; relationName?: string };
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
  prompt: string | null;
  automaticCompletion: false;
  // Parsed server-side from `forest:optionConditions` (flowId → answer). Its presence is what makes
  // the gateway deterministic.
  preRecordedArgs?: {
    optionConditions: Array<{
      option: string;
      aggregator: 'and' | 'or';
      conditions: Array<{
        sourceStepId: string;
        fieldName: string;
        operator: string;
        value?: unknown;
      }>;
    }>;
    fallbackOption: string;
  };
}

export interface ServerWorkflowEscalation extends ServerWorkflowStepBase {
  type: ServerStepTypeEnum.Escalation;
  prompt: string | null;
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

export enum ServerWorkflowTriggerType {
  manual = 'manual',
  webhook = 'webhook',
  mcp = 'mcp',
  dataChange = 'dataChange',
}

export interface ServerHydratedWorkflowRun {
  id: number;
  workflowId: string;
  collectionId: string;
  collectionName: string | null;
  selectedRecordId: string;
  bpmnVersion: string;
  runState: ServerWorkflowRunState;
  triggerType?: ServerWorkflowTriggerType;
  workflowHistory: ServerStepHistory[];
  /** Server types declare `Date`; Express serializes to ISO 8601 string on the wire. */
  createdAt: string;
  updatedAt: string;
  userId: number;
  renderingId: number;
  lockedAt?: string | null;
  userProfile: ServerUserProfile;
  /** The project's IANA zone. Absent from an orchestrator that predates it, null when unset. */
  timezone?: string | null;
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

// --- Automated inboxes (executor routes, PRD-1177 "Step 0" contract) ---
//
// Zod-validated rather than cast: these payloads drive workflow runs on the customer's data, and
// the orchestrator ships independently, so a shape the executor cannot read must be dropped with a
// log instead of being walked blindly. Schemas are non-strict on purpose — a field the server adds
// is stripped, never a reason to refuse the config (same rule as `CollectionSchemaSchema`).

export type ServerPlainConditionTree =
  | { field: string; operator?: string; value?: unknown }
  | { aggregator?: string; conditions: ServerPlainConditionTree[] };

// Branch first, deliberately: a node carrying both `conditions` and `field` is ambiguous, and the
// leaf schema would match it and strip the conditions, leaving a filter that reads a different
// segment than the one configured. agent-client's own `toWireFilter` resolves it the same way.
const ServerPlainConditionTreeSchema: z.ZodType<ServerPlainConditionTree> = z.lazy(() =>
  z.union([
    z.object({
      aggregator: z.string().optional(),
      conditions: z.array(ServerPlainConditionTreeSchema),
    }),
    z.object({ field: z.string(), operator: z.string().optional(), value: z.unknown() }),
  ]),
);

export const ServerAutomatedSegmentDescriptorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('smart'), name: z.string().min(1) }),
  z.object({
    kind: z.literal('sql'),
    query: z.string().min(1),
    // Null on the lianas that run a bare `segmentQuery` themselves (forest-rails,
    // forest-express-sequelize). The server never emits a `sql` descriptor without one for a v2
    // agent — it degrades the inbox instead.
    connectionName: z.string().nullish(),
  }),
  z.object({ kind: z.literal('filter'), conditionTree: ServerPlainConditionTreeSchema }),
]);
export type ServerAutomatedSegmentDescriptor = z.infer<
  typeof ServerAutomatedSegmentDescriptorSchema
>;

// `ServerUserProfile` without `serverToken`: there is no run yet, and the poller only reaches the
// SaaS with the environment secret. The executor mints its agent JWT from this profile, through the
// same `toStepUser` the run envelope goes through — which is what keeps the two shapes tied.
export const ServerAutomatedInboxServiceAccountProfileSchema = z.object({
  id: z.number(),
  email: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  team: z.string().nullable(),
  renderingId: z.number().int().nonnegative(),
  role: z.string().nullable(),
  permissionLevel: z.string().nullable(),
  tags: z.record(z.string(), z.string()),
});
export type ServerAutomatedInboxServiceAccountProfile = z.infer<
  typeof ServerAutomatedInboxServiceAccountProfileSchema
>;

// Only what the poller reads is required. A field it merely logs must never be the reason an inbox
// is dropped from the sweep, and `.nullable()` alone would still reject an omitted key.
export const ServerAutomatedInboxConfigSchema = z.object({
  inboxId: z.string().min(1),
  renderingId: z.number().int().nonnegative(),
  teamId: z.number().int().nonnegative().optional(),
  workflowId: z.string().min(1).optional(),
  collectionId: z.string().min(1).optional(),
  collectionName: z.string().min(1),
  primaryKeys: z.array(z.string().min(1)).min(1),
  maxConcurrentRuns: z.number().int().positive(),
  timezone: z.string().nullish(),
  // Which agent answers the segment read. Absent on an orchestrator that predates the exclusion
  // filter, which reads as unknown: the poller then pads its page, as it always did.
  liana: z.string().nullish(),
  segment: ServerAutomatedSegmentDescriptorSchema,
  serviceAccountProfile: ServerAutomatedInboxServiceAccountProfileSchema,
});
export type ServerAutomatedInboxConfig = z.infer<typeof ServerAutomatedInboxConfigSchema>;

export const ServerAutomatedInboxesResponseSchema = z.object({
  inboxes: z.array(z.unknown()),
});

export const SERVER_INBOX_ASSIGNMENT_STATES = [
  'todo',
  'doing',
  'done',
  'canceled',
  'auto-canceled',
] as const;

// States are read as plain strings, not enums: the poller only ever tests set membership, and one
// assignment in a state a newer orchestrator introduced must not take the whole inbox down. The
// known values live in the constants above, for the poller to compare against.
export const ServerAutomatedInboxAssignmentSchema = z.object({
  recordId: z.string(),
  state: z.string(),
  workflowRunId: z.number().nullish(),
  runState: z.string().nullish(),
});
export type ServerAutomatedInboxAssignment = z.infer<typeof ServerAutomatedInboxAssignmentSchema>;

export const ServerAutomatedInboxAssignmentsResponseSchema = z.object({
  assignments: z.array(ServerAutomatedInboxAssignmentSchema),
});

export interface ServerAutomatedInboxSyncRequest {
  closed: { recordId: string; stillInSegment: boolean }[];
  candidates: string[];
}

export const SERVER_AUTOMATED_INBOX_SYNC_OUTCOMES = [
  'started',
  'skipped-active-run',
  'skipped-assigned',
  'skipped-cap',
  'escalated',
  'cleaned',
] as const;
export type ServerAutomatedInboxSyncOutcome = (typeof SERVER_AUTOMATED_INBOX_SYNC_OUTCOMES)[number];

export const ServerAutomatedInboxSyncResponseSchema = z.object({
  results: z.array(
    z.object({
      recordId: z.string(),
      // Unknown outcomes are kept as-is: the poller only counts them for logs, and refusing the
      // whole response would stop a sync the server already applied.
      outcome: z.string(),
    }),
  ),
});
export type ServerAutomatedInboxSyncResponse = z.infer<
  typeof ServerAutomatedInboxSyncResponseSchema
>;
