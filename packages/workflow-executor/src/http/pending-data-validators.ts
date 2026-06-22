import { z } from 'zod';

import { deserializeRecordId } from '../adapters/record-id-serializer';

// Per-step-type schemas for the userConfirmation payload sent by the front via
// POST /runs/:runId/trigger. Validated into `execution.userConfirmation`; schemas
// use .strict() to reject unknown fields.

const updateRecordPatchSchema = z
  .object({
    userConfirmed: z.boolean(),
    value: z.unknown().optional(),
  })
  .strict();

const triggerActionPatchSchema = z
  .object({
    userConfirmed: z.boolean(),
    // Opaque action result from the frontend. Required when userConfirmed=true; the
    // presence check lives in the step-executor so a descriptive StepStateError can
    // name the runId/stepIndex — not achievable from inside a zod schema.
    actionResult: z.unknown().optional(),
    // The front executes the action natively, so it self-reports the final form
    // values it submitted (lets the executor diff against the AI prefill for the audit trail).
    submittedValues: z.record(z.string(), z.unknown()).optional(),
    // Whether the native submit actually executed the action, or only created an approval request
    // (non-blocking): downstream AI steps must be told an awaiting-approval action did NOT run.
    submissionOutcome: z.enum(['executed', 'pending-approval']).optional(),
  })
  .strict();

const mcpPatchSchema = z.object({ userConfirmed: z.boolean() }).strict();

// Accepts two shapes:
//   1. Confirmation patch: `userConfirmed: boolean` (+ optional overrides) — finalizes
//      the step or skips it.
//   2. Field-preview patch: `fieldName: string` alone, with `userConfirmed` omitted —
//      asks the executor to re-list candidates for a different relation WITHOUT
//      finalizing. The executor refreshes pendingData and stays awaiting-input.
//      Required when the frontend lets the user switch relations: the IDs originally
//      stored under `availableRecordIds` belong to the AI-suggested relation only.
const loadRelatedRecordPatchSchema = z
  .object({
    userConfirmed: z.boolean().optional(),
    // User may intentionally switch to a different relation than the one the AI selected.
    // Sent as the technical fieldName (matches CollectionSchemaField.fieldName from the
    // orchestrator); the executor re-derives displayName + relatedCollectionName from
    // the live schema when processing the confirmation.
    fieldName: z.string().min(1).optional(),
    // User may override the AI-selected record; pipe-separated string (e.g. 'id1|id2'),
    // deserialized to an id array. Required when confirming with a relation override —
    // the original record ID belongs to a different collection and cannot be reused.
    // The .pipe(...) rejects empty segments that would build a bogus PK.
    selectedRecordId: z
      .string()
      .min(1)
      .transform(deserializeRecordId)
      .pipe(z.array(z.string().min(1)))
      .optional(),
  })
  .strict()
  .refine(
    data => {
      // Preview patch (no confirm): fieldName alone is sufficient.
      if (data.userConfirmed === undefined) return data.fieldName !== undefined;
      // Confirm patch with relation override: selectedRecordId required.
      if (data.fieldName !== undefined) return data.selectedRecordId !== undefined;

      return true;
    },
    {
      message:
        'selectedRecordId is required when confirming with a relation override, ' +
        'or omit userConfirmed to preview candidates for a different relation',
    },
  );
const guidancePatchSchema = z
  .object({
    userInput: z.string().optional(),
  })
  .strict();

const conditionPatchSchema = z.object({ selectedOption: z.string() }).strict();

// Inferred types — consumed by step-execution-data.ts to type `userConfirmation` precisely,
// removing the need for runtime type guards in executors.
export type UpdateRecordConfirmation = z.infer<typeof updateRecordPatchSchema>;
export type TriggerActionConfirmation = z.infer<typeof triggerActionPatchSchema>;
export type McpConfirmation = z.infer<typeof mcpPatchSchema>;
export type LoadRelatedRecordConfirmation = z.infer<typeof loadRelatedRecordPatchSchema>;

type PatchableStepType =
  | 'update-record'
  | 'trigger-action'
  | 'mcp'
  | 'load-related-record'
  | 'guidance'
  | 'condition';

const patchBodySchemas: Partial<Record<PatchableStepType, z.ZodTypeAny>> = {
  'update-record': updateRecordPatchSchema,
  'trigger-action': triggerActionPatchSchema,
  mcp: mcpPatchSchema,
  'load-related-record': loadRelatedRecordPatchSchema,
  guidance: guidancePatchSchema,
  condition: conditionPatchSchema,
};

export default patchBodySchemas;
