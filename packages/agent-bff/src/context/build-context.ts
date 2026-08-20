import type ReadModel from '../read-model/read-model';
import type { RelationshipType } from '../read-model/read-model';
import type {
  ForestSchemaAction,
  ForestSchemaCollection,
  ForestSchemaField,
} from '@forestadmin/forestadmin-client';

export interface ContextActionField {
  field: string;
  type: unknown;
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
  type: unknown;
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

function toContextValidations(validations: unknown): ContextValidation[] {
  return toArray(validations as unknown[])
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

function toContextField(field: FieldWithWireEnums): ContextField {
  const serialized: ContextField = { field: field.field, type: field.type };

  if (field.relationship) serialized.relationship = field.relationship;
  if (field.reference) serialized.reference = field.reference;
  if (field.inverseOf) serialized.inverseOf = field.inverseOf;

  const polymorphicTargets = toArray(field.polymorphicReferencedModels);
  if (polymorphicTargets.length > 0) serialized.polymorphicTargets = [...polymorphicTargets];

  if (field.isPrimaryKey) serialized.isPrimaryKey = true;
  if (field.isRequired) serialized.isRequired = true;
  if (field.isReadOnly) serialized.isReadOnly = true;

  const enums = toArray(field.enums);
  if (enums.length > 0) serialized.enums = [...enums];

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
  return {
    name: collection.name,
    fields: toArray(collection.fields).map(toContextField),
    actions: toArray(collection.actions)
      .filter(action => readModel.isActionAllowed(collection.name, action.name))
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
