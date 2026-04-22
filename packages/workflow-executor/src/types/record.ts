/** @draft Types derived from the workflow-executor spec -- subject to change. */

import { z } from 'zod';

// -- Schema types (structure of a collection — source: WorkflowPort) --

export const FieldSchemaSchema = z
  .object({
    fieldName: z.string().min(1),
    displayName: z.string().min(1),
    isRelationship: z.boolean(),
    /** Cardinality of the relation. Absent for non-relationship fields. */
    relationType: z.enum(['BelongsTo', 'HasMany', 'HasOne']).optional(),
    /** Target collection name; only meaningful for relationship fields. */
    relatedCollectionName: z.string().optional(),
  })
  .strict();
export type FieldSchema = z.infer<typeof FieldSchemaSchema>;

// ActionSchema.fields / hooks content is a discriminated union owned by the upstream
// `@forestadmin/forestadmin-client` lib and consumed downstream by `@forestadmin/agent-client`.
// We validate the envelope shape only — detail re-validation would duplicate the lib's job.
const ActionFieldsSchema = z.array(z.object({}).passthrough()).optional();
const ActionHooksSchema = z
  .object({
    load: z.boolean(),
    change: z.array(z.unknown()),
  })
  .strict()
  .optional();

export const ActionSchemaSchema = z
  .object({
    name: z.string().min(1),
    displayName: z.string().min(1),
    endpoint: z.string().min(1),
    /** Static form fields. Used as fallback when the agent's /hooks/load route 404s (old Ruby agents). */
    fields: ActionFieldsSchema,
    /** Action lifecycle hooks. Drives agent-client's dynamic form loading. */
    hooks: ActionHooksSchema,
  })
  .strict();
export type ActionSchema = z.infer<typeof ActionSchemaSchema>;

export const CollectionSchemaSchema = z
  .object({
    collectionName: z.string().min(1),
    collectionDisplayName: z.string().min(1),
    primaryKeyFields: z.array(z.string().min(1)).min(1),
    fields: z.array(FieldSchemaSchema),
    actions: z.array(ActionSchemaSchema),
  })
  .strict();
export type CollectionSchema = z.infer<typeof CollectionSchemaSchema>;

// -- Record types (data — source: AgentPort/RunStore) --

export const RecordRefSchema = z
  .object({
    collectionName: z.string().min(1),
    recordId: z.array(z.union([z.string(), z.number()])).min(1),
    // Index of the workflow step that loaded this record.
    stepIndex: z.number().int().nonnegative(),
  })
  .strict();
export type RecordRef = z.infer<typeof RecordRefSchema>;

// No stepIndex — the agent doesn't know about steps.
export type RecordData = Omit<RecordRef, 'stepIndex'> & { values: Record<string, unknown> };
