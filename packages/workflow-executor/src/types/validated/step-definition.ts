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
// each schema declares its own valid modes with .default().catch() for normalization.
const sharedFields = {
  prompt: z.string().optional(),
  aiConfigName: z.string().optional(),
  title: z.string().optional(),
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
  executionType: z
    .enum([AutomatedWithConfirmation, FullyAutomated])
    .default(AutomatedWithConfirmation)
    .catch(AutomatedWithConfirmation),
  preRecordedArgs: z
    .object({
      selectedRecordStepIndex: z.number().int().optional(),
      /** Technical name of the action to trigger */
      actionName: z.string().optional(),
    })
    .optional(),
});
export type TriggerActionStepDefinition = z.infer<typeof TriggerActionStepDefinitionSchema>;

export const LoadRelatedRecordStepDefinitionSchema = z.object({
  ...sharedFields,
  type: z.literal(StepType.LoadRelatedRecord),
  executionType: z
    .enum([AutomatedWithConfirmation, FullyAutomated])
    .default(AutomatedWithConfirmation)
    .catch(AutomatedWithConfirmation),
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
      /**
       * Build-time filter narrowing the candidate records on a 1–n relation (PRD-553). Forest's
       * plain conditionTree, forwarded verbatim to the agent (which validates it at query time) —
       * kept loose here since it's trusted build config, not executor-validated input.
       */
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
  executionType: z.literal(Manual).default(Manual).catch(Manual),
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
