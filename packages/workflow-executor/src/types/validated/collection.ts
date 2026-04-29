/** @draft Types derived from the workflow-executor spec -- subject to change. */

import { z } from 'zod';

// -- Schema types (structure of a collection — source: WorkflowPort) --

// Mirrors PrimitiveTypes from @forestadmin/datasource-toolkit — kept local to avoid
// adding a hard dependency on datasource-toolkit from the executor package.
export const PRIMITIVE_TYPES = [
  'Boolean',
  'Binary',
  'Date',
  'Dateonly',
  'Enum',
  'File',
  'Json',
  'Number',
  'Point',
  'String',
  'Time',
  'Timeonly',
  'Uuid',
] as const;
export type PrimitiveType = (typeof PRIMITIVE_TYPES)[number];

// Mirrors ColumnType = PrimitiveTypes | [ColumnType] | { [key: string]: ColumnType }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ColumnTypeSchema: z.ZodType<any> = z.lazy(() =>
  z.union([
    z.enum(PRIMITIVE_TYPES),
    z.tuple([ColumnTypeSchema]),
    z.record(z.string(), ColumnTypeSchema),
  ]),
);

export const FieldSchemaSchema = z
  .object({
    fieldName: z.string().min(1),
    displayName: z.string().min(1),
    isRelationship: z.boolean(),
    /** Cardinality of the relation. Absent for non-relationship fields. */
    relationType: z.enum(['BelongsTo', 'HasMany', 'HasOne', 'BelongsToMany']).optional(),
    /** Target collection name; only meaningful for relationship fields. */
    relatedCollectionName: z.string().optional(),
    /** Column type — null for relationship fields. */
    type: ColumnTypeSchema.nullable(),
    /** Allowed values for Enum fields. */
    enumValues: z.array(z.string()).min(1).optional(),
  })
  .strict();
export type FieldSchema = z.infer<typeof FieldSchemaSchema>;

// ActionSchema.fields / hooks content is a discriminated union owned by the upstream
// `@forestadmin/forestadmin-client` lib and consumed downstream by `@forestadmin/agent-client`.
// We validate the envelope shape only — detail re-validation would duplicate the lib's job.
const ActionFieldsSchema = z.array(z.looseObject({})).optional();
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
    // null when the rendering has no explicit displayName configured — normalized to collectionName.
    collectionDisplayName: z.string().nullable(),
    primaryKeyFields: z.array(z.string().min(1)).min(1),
    fields: z.array(FieldSchemaSchema),
    actions: z.array(ActionSchemaSchema),
  })
  .strict()
  .transform(data => ({
    ...data,
    collectionDisplayName: data.collectionDisplayName || data.collectionName,
  }));
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
