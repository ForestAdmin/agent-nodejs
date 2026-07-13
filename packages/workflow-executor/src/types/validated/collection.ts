import { z } from 'zod';

// -- Schema types (structure of a collection — source: WorkflowPort) --
//
// These schemas (Field/Action/Collection) come from the orchestrator, which deploys independently
// and evolves this contract over time. They intentionally omit `.strict()` so unknown keys are
// stripped, not rejected, and require only structural fields — step-specific props are optional and
// asserted at use-time by the consuming executor. Don't re-add `.strict()` here.

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

// Mirrors ColumnType = PrimitiveTypes | [ColumnType] | { [key: string]: ColumnType }.
// The orchestrator additionally serializes composite types as { fields: [{ field, type }] }
// (array-of-entries wire form) — accepted here and normalized to the native record shape.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ColumnTypeSchema: z.ZodType<any> = z.lazy(() =>
  z.union([
    z.enum(PRIMITIVE_TYPES),
    z.tuple([ColumnTypeSchema]),
    z.record(z.string(), ColumnTypeSchema),
    z
      .object({
        fields: z.array(z.object({ field: z.string(), type: ColumnTypeSchema })),
      })
      .transform(obj => Object.fromEntries(obj.fields.map(f => [f.field, f.type]))),
  ]),
);

export const FieldSchemaSchema = z.object({
  fieldName: z.string().min(1),
  displayName: z.string().min(1),
  isRelationship: z.boolean(),
  relationType: z.enum(['BelongsTo', 'HasMany', 'HasOne', 'BelongsToMany']).optional(),
  relatedCollectionName: z.string().optional(),
  // Polymorphic relations: discriminator column + candidate target collections, resolved per record.
  polymorphicTypeField: z.string().optional(),
  polymorphicReferencedModels: z.array(z.string()).optional(),
  // forest-rails apimaps carry field types this contract can't model — hand-authored smart-field
  // type strings, and `[null]` from array columns the liana fails to map. They must not fail the
  // whole collection schema; an unparseable type normalizes to null (consumers already guard on it).
  type: ColumnTypeSchema.nullable().optional().catch(null),
  enumValues: z.array(z.string()).min(1).optional(),
});
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
  .optional();

export const ActionSchemaSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  endpoint: z.string().min(1),
  type: z.enum(['single', 'bulk', 'global']).optional(),
  /** Static form fields. Used as fallback when the agent's /hooks/load route 404s (old Ruby agents). */
  fields: ActionFieldsSchema,
  /** Action lifecycle hooks. Drives agent-client's dynamic form loading. */
  hooks: ActionHooksSchema,
});
export type ActionSchema = z.infer<typeof ActionSchemaSchema>;

export const CollectionSchemaSchema = z
  .object({
    collectionName: z.string().min(1),
    collectionId: z.string().min(1),
    // null when the rendering has no explicit displayName configured — normalized to collectionName.
    collectionDisplayName: z.string().nullable(),
    primaryKeyFields: z.array(z.string().min(1)).min(1),
    // Layout-level "reference field" used to display a record (e.g. "name", "title").
    // Null when the team didn't configure one; callers fall back to the primary key.
    referenceField: z.string().nullable().optional(),
    fields: z.array(FieldSchemaSchema),
    actions: z.array(ActionSchemaSchema).optional().default([]),
  })
  .transform(data => ({
    ...data,
    collectionDisplayName: data.collectionDisplayName || data.collectionName,
  }));
export type CollectionSchema = z.infer<typeof CollectionSchemaSchema>;

// -- Record types (data — source: AgentPort/RunStore) --

export const RecordRefSchema = z
  .object({
    collectionName: z.string().min(1),
    recordId: z.array(z.union([z.string().min(1), z.number()])).min(1),
    // Index of the workflow step that loaded this record.
    stepIndex: z.number().int().nonnegative(),
  })
  .strict();
export type RecordRef = z.infer<typeof RecordRefSchema>;

// A record's primary key: one segment for a simple key, several for a composite key.
export type RecordId = RecordRef['recordId'];

// No stepIndex — the agent doesn't know about steps.
export type RecordData = Omit<RecordRef, 'stepIndex'> & { values: Record<string, unknown> };
