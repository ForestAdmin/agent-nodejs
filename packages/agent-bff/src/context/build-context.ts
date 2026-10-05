import type { FieldType } from '../read-model/field-type';
import type ReadModel from '../read-model/read-model';
import type { RelationshipType } from '../read-model/read-model';
import type {
  ForestSchemaAction,
  ForestSchemaCollection,
  ForestSchemaField,
} from '@forestadmin/forestadmin-client';

import { publishedRecordKeys } from '@forestadmin/agent-client';

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
  isPrimaryKeyDerived?: boolean;
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
  recordKeys: ReadonlyMap<string, string>,
  derivedPrimaryKeys: ReadonlySet<string>,
): ContextField {
  const serialized: ContextField = { field: field.field, type: field.type };

  const key = recordKeys.get(field.field);
  if (key) serialized.recordKey = key;

  if (field.relationship) serialized.relationship = field.relationship;
  if (field.reference) serialized.reference = field.reference;
  if (field.inverseOf) serialized.inverseOf = field.inverseOf;

  const polymorphicTargets = toArray(field.polymorphicReferencedModels);
  if (polymorphicTargets.length > 0) serialized.polymorphicTargets = [...polymorphicTargets];

  // The read-model derives a key when the schema declares none, and the BFF builds record
  // identifiers from it. Publishing only the schema's flag would leave a client unable to name the
  // key the BFF is actually using.
  //
  // A derived key is flagged as such, because it is a GUESS: the schema published nothing, so this
  // field named `id` may not be the real key. Publishing it as a plain `isPrimaryKey` would send a
  // client to filter on it, and a filter against a column that is not the key answers 200 with no
  // row — a silence far worse than the 422 it would get on a field the collection does not expose.
  if (!field.isPrimaryKey && derivedPrimaryKeys.has(field.field)) {
    serialized.isPrimaryKey = true;
    serialized.isPrimaryKeyDerived = true;
  } else if (field.isPrimaryKey) {
    serialized.isPrimaryKey = true;
  }

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
  const recordKeys = publishedRecordKeys(fields.map(field => field.field));
  const derivedPrimaryKeys = new Set(
    readModel.getPrimaryKeys(collection.name).map(key => key.name),
  );

  return {
    name: collection.name,
    fields: fields.map(field => toContextField(field, recordKeys, derivedPrimaryKeys)),
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
