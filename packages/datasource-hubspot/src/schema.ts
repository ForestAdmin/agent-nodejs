import { CachedCollectionSchema, ColumnType, LeafField } from '@forestadmin/datasource-cached';
import { Logger } from '@forestadmin/datasource-toolkit';
import { Client } from '@hubspot/api-client';

import { HubSpotOptions } from './types';

async function getCollectionSchema(
  client: Client,
  collectionName: string,
  fields: string[],
  logger?: Logger,
): Promise<CachedCollectionSchema> {
  const collection: CachedCollectionSchema = {
    name: collectionName,
    fields: {
      id: { type: 'String', isPrimaryKey: true, isReadOnly: true },
    },
  };

  const properties = await client.crm.properties.coreApi.getAll(collectionName);

  for (const fieldName of fields) {
    const property = properties.results.find(p => p.name === fieldName);
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

export default async function getSchema<TypingsHubspot>(
  client: Client,
  collections: HubSpotOptions<TypingsHubspot>['collections'],
  logger?: Logger,
): Promise<CachedCollectionSchema[]> {
  return Promise.all(
    Object.entries(collections).map(([collectionName, fields]) =>
      getCollectionSchema(client, collectionName, fields, logger),
    ),
  );
}
