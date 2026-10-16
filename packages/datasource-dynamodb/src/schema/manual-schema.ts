import type {
  AttributeSchema,
  CollectionDefinition,
  DynamoDataType,
  FieldDefinition,
  IndexModel,
  KeyAttribute,
  ManualSchemaConfig,
  TableModel,
} from '../types';

import { ValidationError } from '@forestadmin/datasource-toolkit';

import { PATH_SEPARATOR } from '../utils/serializer';

const FIELD_TYPES: DynamoDataType[] = [
  'string',
  'number',
  'boolean',
  'date',
  'dateonly',
  'timeonly',
  'array',
  'object',
  'null',
  'point',
  'binary',
];
const SCAN_POLICIES = ['allow', 'warn', 'deny'];
const KEY_TYPES = ['string', 'number'];

function validateFields(fields: FieldDefinition[], collectionName: string, path = ''): void {
  const names = new Set<string>();

  for (const field of fields) {
    const fullPath = path ? `${path}${PATH_SEPARATOR}${field.name}` : field.name;

    if (!field.name) {
      throw new ValidationError(`A field of collection '${collectionName}' has no name`);
    }

    if (field.name.includes(PATH_SEPARATOR)) {
      throw new ValidationError(
        `Field '${fullPath}' in collection '${collectionName}' contains '${PATH_SEPARATOR}', ` +
          `which names nested attributes`,
      );
    }

    if (names.has(field.name)) {
      throw new ValidationError(
        `Duplicate field name: '${fullPath}' in collection '${collectionName}'`,
      );
    }

    names.add(field.name);

    if (!FIELD_TYPES.includes(field.type)) {
      throw new ValidationError(
        `Field '${fullPath}' in collection '${collectionName}' has invalid type '${field.type}'. ` +
          `Valid types: ${FIELD_TYPES.join(', ')}`,
      );
    }

    if (field.type === 'array') {
      if (!field.subType) {
        throw new ValidationError(
          `Array field '${fullPath}' in collection '${collectionName}' must have a subType`,
        );
      }

      if (field.subType === 'object' && !field.fields?.length) {
        throw new ValidationError(
          `Array field '${fullPath}' in collection '${collectionName}' of objects must have ` +
            `nested field definitions`,
        );
      }
    }

    if (field.type === 'object' && !field.fields?.length) {
      throw new ValidationError(
        `Object field '${fullPath}' in collection '${collectionName}' must have nested field ` +
          `definitions`,
      );
    }

    if (field.fields) validateFields(field.fields, collectionName, fullPath);
  }
}

function validateCollection(collection: CollectionDefinition): void {
  const { name } = collection;

  if (!name) throw new ValidationError('Collection must have a name');

  if (!collection.tableName) {
    throw new ValidationError(`Collection '${name}' must have a tableName`);
  }

  if (!collection.partitionKey?.name) {
    throw new ValidationError(`Collection '${name}' must have a partitionKey`);
  }

  for (const key of [collection.partitionKey, collection.sortKey].filter(Boolean)) {
    if (!KEY_TYPES.includes(key.type)) {
      throw new ValidationError(
        `Key '${key.name}' of collection '${name}' must be a string or a number`,
      );
    }
  }

  if (collection.sortKey?.name === collection.partitionKey.name) {
    throw new ValidationError(
      `Collection '${name}' uses '${collection.partitionKey.name}' as both partition key and sort key`,
    );
  }

  const { entity } = collection;

  if (entity) {
    const hasDiscriminator = entity.attribute !== undefined || entity.value !== undefined;

    const incompleteDiscriminator =
      hasDiscriminator && (entity.attribute === undefined || entity.value === undefined);

    if (hasDiscriminator === (entity.sortKeyPrefix !== undefined) || incompleteDiscriminator) {
      throw new ValidationError(
        `Collection '${name}' entity must use either 'attribute'/'value' or 'sortKeyPrefix'`,
      );
    }

    if (entity.sortKeyPrefix !== undefined && !collection.sortKey) {
      throw new ValidationError(
        `Collection '${name}' has no sortKey, so 'entity.sortKeyPrefix' cannot be used`,
      );
    }
  }

  if (collection.scanPolicy !== undefined && !SCAN_POLICIES.includes(collection.scanPolicy)) {
    throw new ValidationError(
      `Collection '${name}' has an invalid scanPolicy '${collection.scanPolicy}'`,
    );
  }

  validateFields(collection.fields ?? [], name);
}

export function validateManualSchema(schema: ManualSchemaConfig): void {
  if (!Array.isArray(schema?.collections)) {
    throw new ValidationError('Manual schema must have a collections array');
  }

  if (schema.collections.length === 0) {
    throw new ValidationError('Manual schema must have at least one collection');
  }

  const names = new Set<string>();

  for (const collection of schema.collections) {
    validateCollection(collection);

    if (names.has(collection.name)) {
      throw new ValidationError(`Duplicate collection name: '${collection.name}'`);
    }

    names.add(collection.name);
  }
}

function flattenFields(fields: FieldDefinition[], prefix = ''): Record<string, AttributeSchema> {
  const attributes: Record<string, AttributeSchema> = {};

  for (const field of fields) {
    const path = prefix ? `${prefix}${PATH_SEPARATOR}${field.name}` : field.name;

    if (field.type === 'object') {
      Object.assign(attributes, flattenFields(field.fields, path));
    } else {
      attributes[path] = {
        type: field.type,
        nullable: !!field.nullable,
        ...(field.type === 'array' && field.subType === 'object'
          ? { items: flattenFields(field.fields) }
          : {}),
      };
    }
  }

  return attributes;
}

const toKey = (key: { name: string; type: 'string' | 'number' }): KeyAttribute => ({
  name: key.name,
  type: key.type === 'number' ? 'N' : 'S',
});

function toModel(collection: CollectionDefinition): TableModel {
  const partitionKey = toKey(collection.partitionKey);
  const sortKey = collection.sortKey ? toKey(collection.sortKey) : undefined;
  const keys: Record<string, AttributeSchema> = {};

  for (const key of [partitionKey, sortKey].filter(Boolean)) {
    keys[key.name] = { type: key.type === 'N' ? 'number' : 'string', nullable: false };
  }

  const indexes: IndexModel[] = (collection.indexes ?? []).map(index => ({
    name: index.name,
    type: index.type,
    partitionKey: toKey(index.partitionKey),
    sortKey: index.sortKey ? toKey(index.sortKey) : undefined,
    projectsAllAttributes: index.projectsAllAttributes ?? true,
    coversAllItems: index.coversAllItems ?? false,
  }));

  return {
    name: collection.name,
    tableName: collection.tableName,
    partitionKey,
    sortKey,
    indexes,
    // The configured key types are the table's: a field of the same name cannot change them.
    schema: { ...flattenFields(collection.fields), ...keys },
    entity: collection.entity,
    enableCount: collection.enableCount,
    scanPolicy: collection.scanPolicy,
    maxScannedItems: collection.maxScannedItems,
    overrideTypeConverter: collection.overrideTypeConverter,
  };
}

export function convertManualSchema(schema: ManualSchemaConfig): TableModel[] {
  validateManualSchema(schema);

  return schema.collections.map(toModel);
}
