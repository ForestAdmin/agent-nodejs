import type { FieldType } from '../read-model/field-type';
import type ReadModel from '../read-model/read-model';
import type { RelationshipType } from '../read-model/read-model';
import type {
  ForestSchemaAction,
  ForestSchemaCollection,
  ForestSchemaField,
} from '@forestadmin/forestadmin-client';

import recordKey from '../data/record-key';

export interface ContextActionField {
  field: string;
  type: FieldType;
  isRequired?: boolean;
  defaultValue?: unknown;
  enums?: string[];
}

export interface ContextAction {
  id: string;
  name: string;
  type: ForestSchemaAction['type'];
  fields: ContextActionField[];
}

export interface ContextValidation {
  type: string;
  value?: unknown;
}

export interface ContextField {
  field: string;
  recordKey?: string;
  type: FieldType;
  relationship?: RelationshipType;
  reference?: string;
  inverseOf?: string;
  polymorphicTargets?: string[];
  isPrimaryKey?: boolean;
  isRequired?: boolean;
  isReadOnly?: boolean;
  enums?: string[];
  validations?: ContextValidation[];
}

export interface ContextCollection {
  name: string;
  fields: ContextField[];
  actions: ContextAction[];
}

export interface ContextMeta {
  schemaRevision: number;
  environmentId?: number;
}

export interface AgentContext {
  collections: ContextCollection[];
  meta: ContextMeta;
}

function toArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

type FieldWithWireEnums = ForestSchemaField & { enums?: string[] };

/** The deserializer writes the JSON:API resource identifier under this key, always. */
const RESOURCE_ID_KEY = 'id';

/**
 * The record keys this collection cannot promise, because more than one thing lands on them.
 *
 * Two fields whose technical names differ only by casing collapse onto one key (`first_name` and
 * `firstName` both reach the response as `firstName`), and a field named `Id` or `ID` collapses onto
 * the resource identifier, whose value the deserializer writes over the projected attribute — so
 * reading that field under `id` yields the record's id rather than the field's value. Publishing a
 * `recordKey` in either case would point a consumer at a value that is not the field's, which is
 * worse than publishing nothing: `recordKey` is absent, the caller falls back to `field`, and the
 * ambiguity stays visible instead of being papered over.
 */
function ambiguousRecordKeys(fields: FieldWithWireEnums[]): Set<string> {
  const claimants = new Map<string, number>();

  for (const field of fields) {
    const key = recordKey(field.field);
    claimants.set(key, (claimants.get(key) ?? 0) + 1);
  }

  const ambiguous = new Set<string>();

  for (const [key, count] of claimants) {
    if (count > 1) ambiguous.add(key);
  }

  const idClaimedByAnotherField = fields.some(
    field => !field.isPrimaryKey && recordKey(field.field) === RESOURCE_ID_KEY,
  );

  if (idClaimedByAnotherField) ambiguous.add(RESOURCE_ID_KEY);

  return ambiguous;
}

function toContextValidations(validations: unknown[] | null | undefined): ContextValidation[] {
  return toArray(validations)
    .filter(
      (entry): entry is { type: string; value?: unknown } =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as { type?: unknown }).type === 'string',
    )
    .map(entry =>
      'value' in entry ? { type: entry.type, value: entry.value } : { type: entry.type },
    );
}

function toContextField(
  field: FieldWithWireEnums,
  ambiguousKeys: ReadonlySet<string>,
): ContextField {
  const serialized: ContextField = { field: field.field, type: field.type };

  const key = recordKey(field.field);
  if (key !== field.field && !ambiguousKeys.has(key)) serialized.recordKey = key;

  if (field.relationship) serialized.relationship = field.relationship;
  if (field.reference) serialized.reference = field.reference;
  if (field.inverseOf) serialized.inverseOf = field.inverseOf;

  const polymorphicTargets = toArray(field.polymorphicReferencedModels);
  if (polymorphicTargets.length > 0) serialized.polymorphicTargets = [...polymorphicTargets];

  if (field.isPrimaryKey) serialized.isPrimaryKey = true;
  if (field.isRequired) serialized.isRequired = true;
  if (field.isReadOnly) serialized.isReadOnly = true;

  if (Array.isArray(field.enums)) serialized.enums = [...field.enums];

  const validations = toContextValidations(field.validations);
  if (validations.length > 0) serialized.validations = validations;

  return serialized;
}

function toContextActionField(field: ForestSchemaAction['fields'][number]): ContextActionField {
  const serialized: ContextActionField = { field: field.field, type: field.type };

  if (field.isRequired !== undefined) serialized.isRequired = field.isRequired;
  if (field.defaultValue !== undefined) serialized.defaultValue = field.defaultValue;
  if (Array.isArray(field.enums)) serialized.enums = [...field.enums];

  return serialized;
}

function toContextAction(action: ForestSchemaAction): ContextAction {
  return {
    id: action.id,
    name: action.name,
    type: action.type,
    fields: toArray(action.fields)
      .filter(field => typeof field === 'object' && field !== null)
      .map(toContextActionField),
  };
}

function toContextCollection(
  collection: ForestSchemaCollection,
  readModel: ReadModel,
): ContextCollection {
  const allowedActions = readModel.getActionEndpoints()[collection.name] ?? {};
  const fields = toArray(collection.fields).filter(
    field => typeof field === 'object' && field !== null,
  );
  const ambiguousKeys = ambiguousRecordKeys(fields);

  return {
    name: collection.name,
    fields: fields.map(field => toContextField(field, ambiguousKeys)),
    actions: toArray(collection.actions)
      .filter(action => {
        const allowed = allowedActions[action?.name];

        return allowed !== undefined && allowed.id === action.id;
      })
      .map(toContextAction),
  };
}

function toContextMeta({ schemaRevision, environmentId }: ContextMeta): ContextMeta {
  const meta: ContextMeta = { schemaRevision };

  if (environmentId !== undefined) meta.environmentId = environmentId;

  return meta;
}

export default function buildContext(
  collections: ForestSchemaCollection[],
  readModel: ReadModel,
  meta: ContextMeta,
): AgentContext {
  return {
    collections: collections.map(collection => toContextCollection(collection, readModel)),
    meta: toContextMeta(meta),
  };
}
