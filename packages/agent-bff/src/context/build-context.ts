import type ReadModel from '../read-model/read-model';
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

export interface ContextField {
  field: string;
  type: unknown;
  reference?: string;
  inverseOf?: string;
  isRequired?: boolean;
  isReadOnly?: boolean;
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

function toContextField(field: ForestSchemaField): ContextField {
  const serialized: ContextField = { field: field.field, type: field.type };

  if (field.reference) serialized.reference = field.reference;
  if (field.inverseOf) serialized.inverseOf = field.inverseOf;
  if (field.isRequired) serialized.isRequired = true;
  if (field.isReadOnly) serialized.isReadOnly = true;

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
    fields: toArray(action.fields).map(toContextActionField),
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

export default function buildContext(
  collections: ForestSchemaCollection[],
  readModel: ReadModel,
  meta: ContextMeta,
): AgentContext {
  return {
    collections: collections
      .filter(collection => readModel.isCollectionAllowed(collection.name))
      .map(collection => toContextCollection(collection, readModel)),
    meta: meta.environmentId === undefined ? { schemaRevision: meta.schemaRevision } : { ...meta },
  };
}
