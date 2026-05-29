import { z } from 'zod';

// Per-step-type schemas for the userConfirmation payload sent by the front via
// POST /runs/:runId/trigger. Validated into `execution.userConfirmation`; schemas
// use .strict() to reject unknown fields.

const updateRecordPatchSchema = z
  .object({
    userConfirmed: z.boolean(),
    // User may override the AI-proposed value with any field type (boolean, array, etc.).
    // The business type is validated/coerced field-aware in the update-record step executor
    // (buildZodSchemaForField), so the HTTP schema stays a shape guard only — aligned with
    // `actionResult` below.
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
  })
  .strict();

const mcpPatchSchema = z.object({ userConfirmed: z.boolean() }).strict();

const loadRelatedRecordPatchSchema = z
  .object({
    userConfirmed: z.boolean(),
    // User may intentionally switch to a different relation than the one the AI selected.
    // The executor re-derives relatedCollectionName and displayName from FieldSchema when
    // processing the confirmation.
    name: z.string().min(1).optional(),
    // User may override the AI-selected record; must be non-empty when provided.
    // Required when overriding the relation name — the original record ID belongs to a
    // different collection and cannot be reused for the new relation.
    selectedRecordId: z
      .array(z.union([z.string(), z.number()]))
      .min(1)
      .optional(),
  })
  .strict()
  .refine(data => data.name === undefined || data.selectedRecordId !== undefined, {
    message: 'selectedRecordId is required when overriding the relation name',
  });
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
