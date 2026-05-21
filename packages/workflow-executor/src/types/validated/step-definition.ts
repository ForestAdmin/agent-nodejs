/** @draft Types derived from the workflow-executor spec -- subject to change. */

import { z } from 'zod';

import { ServerStepExecutionTypeEnum } from '../../adapters/server-types';

export enum StepType {
  Condition = 'condition',
  ReadRecord = 'read-record',
  UpdateRecord = 'update-record',
  TriggerAction = 'trigger-action',
  LoadRelatedRecord = 'load-related-record',
  Mcp = 'mcp',
  Guidance = 'guidance',
}

const baseFields = {
  prompt: z.string().optional(),
  aiConfigName: z.string().optional(),
  executionType: z.enum(ServerStepExecutionTypeEnum).optional(),
};

export const ConditionStepDefinitionSchema = z.object({
  ...baseFields,
  type: z.literal(StepType.Condition),
  options: z.array(z.string()).min(2),
});
export type ConditionStepDefinition = z.infer<typeof ConditionStepDefinitionSchema>;

export const ReadRecordStepDefinitionSchema = z.object({
  ...baseFields,
  type: z.literal(StepType.ReadRecord),
  preRecordedArgs: z
    .object({
      selectedRecordStepIndex: z.number().int().optional(),
      /** Display names of the fields to read */
      fieldDisplayNames: z.array(z.string()).optional(),
    })
    .optional(),
});
export type ReadRecordStepDefinition = z.infer<typeof ReadRecordStepDefinitionSchema>;

export const UpdateRecordStepDefinitionSchema = z.object({
  ...baseFields,
  type: z.literal(StepType.UpdateRecord),
  preRecordedArgs: z
    .object({
      selectedRecordStepIndex: z.number().int().optional(),
      /** Display name of the field to update */
      fieldDisplayName: z.string().optional(),
      value: z.unknown().optional(),
    })
    .optional(),
});
export type UpdateRecordStepDefinition = z.infer<typeof UpdateRecordStepDefinitionSchema>;

export const TriggerActionStepDefinitionSchema = z.object({
  ...baseFields,
  type: z.literal(StepType.TriggerAction),
  preRecordedArgs: z
    .object({
      selectedRecordStepIndex: z.number().int().optional(),
      /** Display name of the action to trigger */
      actionDisplayName: z.string().optional(),
    })
    .optional(),
});
export type TriggerActionStepDefinition = z.infer<typeof TriggerActionStepDefinitionSchema>;

export const LoadRelatedRecordStepDefinitionSchema = z.object({
  ...baseFields,
  type: z.literal(StepType.LoadRelatedRecord),
  preRecordedArgs: z
    .object({
      selectedRecordStepIndex: z.number().int().optional(),
      /** Display name of the relation to follow */
      relationDisplayName: z.string().optional(),
      selectedRecordIndex: z.number().int().optional(),
    })
    .optional(),
});
export type LoadRelatedRecordStepDefinition = z.infer<typeof LoadRelatedRecordStepDefinitionSchema>;

export const McpStepDefinitionSchema = z.object({
  ...baseFields,
  type: z.literal(StepType.Mcp),
  mcpServerId: z.string().optional(),
});
export type McpStepDefinition = z.infer<typeof McpStepDefinitionSchema>;

export const GuidanceStepDefinitionSchema = z.object({
  ...baseFields,
  type: z.literal(StepType.Guidance),
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
