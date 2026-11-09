import { z } from 'zod';

import { StepType } from './step-definition';

export const BaseStepStatusSchema = z.enum(['success', 'error']);
export type BaseStepStatus = z.infer<typeof BaseStepStatusSchema>;

// AI steps can pause mid-execution to await user input (awaiting-input).
export const RecordStepStatusSchema = z.enum(['success', 'error', 'awaiting-input']);
export type RecordStepStatus = z.infer<typeof RecordStepStatusSchema>;

// Typed reason for an awaiting-input pause the user must resolve out of band: the Forest server
// validates it and the front reads it to prompt the matching action.
export const AwaitingInputReasonSchema = z.enum(['needs-oauth-reauth', 'pending-approval']);
export type AwaitingInputReason = z.infer<typeof AwaitingInputReasonSchema>;

// The branch a Trigger Action step with approval outcomes takes, named after the outgoing flow.
export const ApprovalOutcomeSchema = z.enum(['approved', 'rejected']);
export type ApprovalOutcome = z.infer<typeof ApprovalOutcomeSchema>;

export const ApprovalRequestRefSchema = z.object({ id: z.string().min(1) }).strict();
export type ApprovalRequestRef = z.infer<typeof ApprovalRequestRefSchema>;

// What the paused step ran: the orchestrator links a request only when it was filed for it. Ids,
// never record values, so it stays within what a StepOutcome may carry.
export const ApprovalActionTargetSchema = z
  .object({
    collectionName: z.string().min(1),
    actionName: z.string().min(1),
    recordId: z.string().min(1),
  })
  .strict();
export type ApprovalActionTarget = z.infer<typeof ApprovalActionTargetSchema>;

// Every value crosses the wire before any consumer branches on it, since widening it is cheap.
// 'empty-source' and 'call-site' are split from configuration because each names the step to fix.
export const ErrorKindSchema = z.enum([
  'operator',
  'configuration',
  'system',
  'empty-source',
  'call-site',
]);
export type ErrorKind = z.infer<typeof ErrorKindSchema>;

// Identifies the step an error is about by index rather than by step id: a LinkTo loop repeats ids,
// so only the index says which iteration the error came from.
export const ErrorSourceStepIndexSchema = z.number().int().nonnegative();

export type StepStatus = BaseStepStatus | RecordStepStatus;

/**
 * StepOutcome is sent to the orchestrator — it must NEVER contain client data.
 * Any privacy-sensitive information (e.g. AI reasoning) must stay in
 * StepExecutionData (persisted in the RunStore, client-side only).
 */
const baseOutcomeFields = {
  stepId: z.string().min(1),
  stepIndex: z.number().int().nonnegative(),
  /** Present when status is 'error'. */
  error: z.string().optional(),
  /** Present when the error has been classified. Absent leaves the error framed as it is today. */
  errorKind: ErrorKindSchema.optional(),
  /** Present when the error is about another step, e.g. a source step that loaded no record. */
  errorSourceStepIndex: ErrorSourceStepIndexSchema.optional(),
};

export const ConditionStepOutcomeSchema = z
  .object({
    ...baseOutcomeFields,
    type: z.literal('condition'),
    status: RecordStepStatusSchema,
    /** Present when status is 'success'. */
    selectedOption: z.string().optional(),
  })
  .strict();
export type ConditionStepOutcome = z.infer<typeof ConditionStepOutcomeSchema>;

export const RecordStepOutcomeSchema = z
  .object({
    ...baseOutcomeFields,
    type: z.literal('record'),
    status: RecordStepStatusSchema,
    approvalRequest: z.object({ id: z.string() }).optional(),
    /** Present when status is 'awaiting-input' because the step waits for its approval requests. */
    awaitingInputReason: AwaitingInputReasonSchema.optional(),
    approvalRequests: z.array(ApprovalRequestRefSchema).optional(),
    actionTarget: ApprovalActionTargetSchema.optional(),
    /** Present on a Trigger Action step with approval outcomes once it succeeds. */
    selectedOption: ApprovalOutcomeSchema.optional(),
    /** The reviewer who decided `selectedOption`; absent when no review was needed. */
    approverId: z.number().int().nullable().optional(),
  })
  .strict();
export type RecordStepOutcome = z.infer<typeof RecordStepOutcomeSchema>;

export const McpStepOutcomeSchema = z
  .object({
    ...baseOutcomeFields,
    type: z.literal('mcp'),
    status: RecordStepStatusSchema,
    /** Present when status is 'awaiting-input' because the step paused for re-authentication. */
    awaitingInputReason: AwaitingInputReasonSchema.optional(),
  })
  .strict();
export type McpStepOutcome = z.infer<typeof McpStepOutcomeSchema>;

export const GuidanceStepOutcomeSchema = z
  .object({
    ...baseOutcomeFields,
    type: z.literal('guidance'),
    status: RecordStepStatusSchema,
  })
  .strict();
export type GuidanceStepOutcome = z.infer<typeof GuidanceStepOutcomeSchema>;

export const StepOutcomeSchema = z.discriminatedUnion('type', [
  ConditionStepOutcomeSchema,
  RecordStepOutcomeSchema,
  McpStepOutcomeSchema,
  GuidanceStepOutcomeSchema,
]);
export type StepOutcome = z.infer<typeof StepOutcomeSchema>;

export function stepTypeToOutcomeType(type: StepType): 'condition' | 'record' | 'mcp' | 'guidance' {
  if (type === StepType.Condition) return 'condition';
  if (type === StepType.Mcp) return 'mcp';
  if (type === StepType.Guidance) return 'guidance';

  return 'record';
}
