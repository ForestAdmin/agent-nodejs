import { z } from 'zod';

export enum StepType {
  Condition = 'condition',
  ReadRecord = 'read-record',
  UpdateRecord = 'update-record',
  TriggerAction = 'trigger-action',
  LoadRelatedRecord = 'load-related-record',
  Mcp = 'mcp',
  Guidance = 'guidance',
}

/**
 * Domain enum for how a step is executed. Decoupled from the server contract
 * (`ServerStepExecutionTypeEnum`) — `step-definition-mapper.ts` is the single translation point.
 */
export enum StepExecutionMode {
  Manual = 'manual',
  AutomatedWithConfirmation = 'automated-with-confirmation',
  FullyAutomated = 'fully-automated',
}

// Shared fields across all step types. executionType is intentionally excluded —
// each schema declares its own valid modes (most with .default().catch() for normalization;
// guidance deliberately omits .catch to fail loud on an unknown mode).
// The orchestrator serializes missing BPMN attributes as JSON null (DOM getAttribute), not as
// absent keys — accept both and normalize to undefined.
const optionalString = z
  .string()
  .nullish()
  .transform(value => value ?? undefined);

const sharedFields = {
  prompt: optionalString,
  aiConfigName: optionalString,
  title: optionalString,
};

// Use z.enum(EnumObject), not z.nativeEnum — the latter is deprecated in zod 4.
const { Manual, AutomatedWithConfirmation, FullyAutomated } = StepExecutionMode;

export const ConditionStepDefinitionSchema = z.object({
  ...sharedFields,
  type: z.literal(StepType.Condition),
  executionType: z.enum([Manual, FullyAutomated]).default(FullyAutomated).catch(FullyAutomated),
  options: z.array(z.string()).min(2),
});
export type ConditionStepDefinition = z.infer<typeof ConditionStepDefinitionSchema>;

export const ReadRecordStepDefinitionSchema = z.object({
  ...sharedFields,
  type: z.literal(StepType.ReadRecord),
  executionType: z.literal(FullyAutomated).default(FullyAutomated).catch(FullyAutomated),
  preRecordedArgs: z
    .object({
      /**
       * "On record" — the source record to read from, referenced by the stable BPMN step id of the
       * previous Load Related Record step that loaded it, or WORKFLOW_START_STEP_ID for the trigger
       * record. Stable across revisions, unlike the runtime stepIndex.
       */
      selectedRecordStepId: z.string().optional(),
      // Legacy runtime index; superseded by selectedRecordStepId. Kept for back-compat.
      selectedRecordStepIndex: z.number().int().optional(),
      /** Technical names of the fields to read */
      fieldNames: z.array(z.string()).optional(),
    })
    .optional(),
});
export type ReadRecordStepDefinition = z.infer<typeof ReadRecordStepDefinitionSchema>;

export const UpdateRecordStepDefinitionSchema = z.object({
  ...sharedFields,
  type: z.literal(StepType.UpdateRecord),
  executionType: z
    .enum([AutomatedWithConfirmation, FullyAutomated])
    .default(AutomatedWithConfirmation)
    .catch(AutomatedWithConfirmation),
  preRecordedArgs: z
    .object({
      selectedRecordStepIndex: z.number().int().optional(),
      /** Technical name of the field to update */
      fieldName: z.string().optional(),
      value: z.unknown().optional(),
    })
    .optional(),
});
export type UpdateRecordStepDefinition = z.infer<typeof UpdateRecordStepDefinitionSchema>;

export const TriggerActionStepDefinitionSchema = z.object({
  ...sharedFields,
  type: z.literal(StepType.TriggerAction),
  // A form-bearing action can be Manual (pause, no AI prefill), AI-assisted
  // (AutomatedWithConfirmation) or Full AI (FullyAutomated). NO `.catch` — coercing a `manual`
  // value to AutomatedWithConfirmation would silently opt the builder back into AI prefill.
  executionType: z
    .enum([Manual, AutomatedWithConfirmation, FullyAutomated])
    .default(AutomatedWithConfirmation),
  preRecordedArgs: z
    .object({
      /**
       * "On record" — the source record the action is triggered on, referenced by the stable BPMN
       * step id of the previous Load Related Record step that loaded it, or WORKFLOW_START_STEP_ID
       * for the trigger record. Stable across revisions, unlike the runtime stepIndex.
       */
      selectedRecordStepId: z.string().optional(),
      /** Technical name of the action to trigger */
      actionName: z.string().optional(),
    })
    .optional(),
});
export type TriggerActionStepDefinition = z.infer<typeof TriggerActionStepDefinitionSchema>;

export const LoadRelatedRecordStepDefinitionSchema = z.object({
  ...sharedFields,
  type: z.literal(StepType.LoadRelatedRecord),
  // No `.catch`: it would silently coerce `manual` to AutomatedWithConfirmation (AI prefill back on).
  executionType: z
    .enum([Manual, AutomatedWithConfirmation, FullyAutomated])
    .default(AutomatedWithConfirmation),
  preRecordedArgs: z
    .object({
      /**
       * "Related to" — the source record, referenced by the stable BPMN step id of the previous
       * Load Related Record step that loaded it, or WORKFLOW_START_STEP_ID for the trigger record.
       * Stable across revisions (clones keep the id) and known at build time (unlike the runtime
       * stepIndex), so the editor can write it deterministically.
       */
      selectedRecordStepId: z.string().optional(),
      /** "From collection" — the relation to follow (technical name) */
      relationName: z.string().optional(),
      /** 1–n relation filter (conditionTree), forwarded verbatim; loosely typed as it's trusted config the agent validates. */
      filters: z.unknown().optional(),
    })
    .optional(),
});
export type LoadRelatedRecordStepDefinition = z.infer<typeof LoadRelatedRecordStepDefinitionSchema>;

/** Sentinel "Related to" reference for the record the workflow was triggered on (the base record). */
export const WORKFLOW_START_STEP_ID = 'workflow-start';

export const McpStepDefinitionSchema = z.object({
  ...sharedFields,
  type: z.literal(StepType.Mcp),
  executionType: z
    .enum([AutomatedWithConfirmation, FullyAutomated])
    .default(AutomatedWithConfirmation)
    .catch(AutomatedWithConfirmation),
  mcpServerId: z.string().min(1),
});
export type McpStepDefinition = z.infer<typeof McpStepDefinitionSchema>;

export const GuidanceStepDefinitionSchema = z.object({
  ...sharedFields,
  type: z.literal(StepType.Guidance),
  // No `.catch`; default Manual (not AWC) — the orchestrator owns the legacy default, so the
  // executor fallback only fires on a missing field, where "never call AI" is the safe direction.
  executionType: z.enum([Manual, AutomatedWithConfirmation, FullyAutomated]).default(Manual),
});
export type GuidanceStepDefinition = z.infer<typeof GuidanceStepDefinitionSchema>;

export const RecordStepDefinitionSchema = z.discriminatedUnion('type', [
  ReadRecordStepDefinitionSchema,
  UpdateRecordStepDefinitionSchema,
  TriggerActionStepDefinitionSchema,
  LoadRelatedRecordStepDefinitionSchema,
]);
export type RecordStepDefinition = z.infer<typeof RecordStepDefinitionSchema>;

export const StepDefinitionSchema = z.discriminatedUnion('type', [
  ConditionStepDefinitionSchema,
  ReadRecordStepDefinitionSchema,
  UpdateRecordStepDefinitionSchema,
  TriggerActionStepDefinitionSchema,
  LoadRelatedRecordStepDefinitionSchema,
  McpStepDefinitionSchema,
  GuidanceStepDefinitionSchema,
]);
export type StepDefinition = z.infer<typeof StepDefinitionSchema>;
