import { z } from 'zod';

import { StepType } from './step-definition';

export const BaseStepStatusSchema = z.enum(['success', 'error']);
export type BaseStepStatus = z.infer<typeof BaseStepStatusSchema>;

// AI steps can pause mid-execution to await user input (awaiting-input).
export const RecordStepStatusSchema = z.enum(['success', 'error', 'awaiting-input']);
export type RecordStepStatus = z.infer<typeof RecordStepStatusSchema>;

// Typed reason for an awaiting-input pause the user must resolve out of band: the Forest server
// validates it and the front reads it to prompt the matching action.
export const AwaitingInputReasonSchema = z.enum(['needs-oauth-reauth']);
export type AwaitingInputReason = z.infer<typeof AwaitingInputReasonSchema>;

// What kind of failure a step error is. All three cross the wire even though only 'operator' drives
// a UI branch today: widening an enum is cheap, changing a cross-service contract is not.
export const ErrorKindSchema = z.enum(['operator', 'configuration', 'system']);
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
