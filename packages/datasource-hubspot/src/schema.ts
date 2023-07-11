import { CachedCollectionSchema, ColumnType, LeafField } from '@forestadmin/datasource-cached';
import { Logger } from '@forestadmin/datasource-toolkit';

import { FieldProperties, FieldPropertiesByCollection, HubSpotOptions } from './types';

function getCollectionSchema(
  collectionName: string,
  fields: string[],
  fieldProperties: FieldProperties,
  logger?: Logger,
): CachedCollectionSchema {
  const collection: CachedCollectionSchema = {
    name: collectionName,
    fields: {
      id: { type: 'String', isPrimaryKey: true, isReadOnly: true },
    },
  };

  for (const fieldName of fields) {
    const property = fieldProperties.find(p => p.name === fieldName);
    if (!property) throw new Error(`property ${fieldName} does not exists`);

    let type: ColumnType;
    let enumValues: string[];

    if (property.type === 'string') type = 'String';
    else if (property.type === 'datetime') type = 'Date';
    else if (property.type === 'number') type = 'Number';
    else if (property.type === 'enumeration') {
      type = 'Enum';
      enumValues = property.options.map(option => option.value);
    } else if (property.type === 'bool') type = 'Boolean';
    else if (property.type === 'phone_number') type = 'String';
    else throw new Error(`Property "${fieldName}" has unsupported type ${property.type}`);

    collection.fields[fieldName] = { type, isPrimaryKey: false, isReadOnly: true };

    if (enumValues?.length === 0) {
      delete collection.fields[fieldName];
      logger?.('Warn', `Property "${fieldName}" has no enum values, it will be ignored`);
    } else if (enumValues) (collection.fields[fieldName] as LeafField).enumValues = enumValues;
  }

  return collection;
}

export default function getSchema<TypingsHubspot>(
  fieldPropertiesByCollection: FieldPropertiesByCollection,
  collections: HubSpotOptions<TypingsHubspot>['collections'],
  logger?: Logger,
): CachedCollectionSchema[] {
  return Object.entries(collections).map(([collectionName, fields]) =>
    getCollectionSchema(
      collectionName,
      fields,
      fieldPropertiesByCollection[collectionName],
      logger,
    ),
  );
}
