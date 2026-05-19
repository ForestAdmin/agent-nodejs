import { z } from 'zod';

// Per-step-type schemas for the `pendingData` payload sent by the front via
// POST /runs/:runId/trigger. Consumed by step executors to validate `incomingPendingData`
// before applying user confirmation or override. Schemas use .strict() to reject unknown fields.

const updateRecordPatchSchema = z
  .object({
    userConfirmed: z.boolean(),
    value: z.string().optional(), // user may override the AI-proposed value
  })
  .strict();

const triggerActionPatchSchema = z
  .object({
    userConfirmed: z.boolean(),
    // Opaque action result from the frontend. Required when userConfirmed=true; the
    // presence check lives in the step-executor so a descriptive StepStateError can
    // name the runId/stepIndex — not achievable from inside a zod schema.
    actionResult: z.unknown().optional(),
  })
  .strict();

const mcpPatchSchema = z.object({ userConfirmed: z.boolean() }).strict();

const loadRelatedRecordPatchSchema = z
  .object({
    userConfirmed: z.boolean(),
    // User may intentionally switch to a different relation than the one the AI selected.
    // The executor re-derives relatedCollectionName and displayName from FieldSchema when
    // processing the confirmation.
    name: z.string().optional(),
    // User may override the AI-selected record; must be non-empty when provided.
    selectedRecordId: z
      .array(z.union([z.string(), z.number()]))
      .min(1)
      .optional(),
  })
  .strict();
// relatedCollectionName, displayName and suggestedFields are NOT accepted — internal executor data.

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
export type GuidanceConfirmation = z.infer<typeof guidancePatchSchema>;

const patchBodySchemas: Partial<Record<string, z.ZodTypeAny>> = {
  'update-record': updateRecordPatchSchema,
  'trigger-action': triggerActionPatchSchema,
  mcp: mcpPatchSchema,
  'load-related-record': loadRelatedRecordPatchSchema,
  guidance: guidancePatchSchema,
  condition: conditionPatchSchema,
};

export default patchBodySchemas;
