import { CachedCollectionSchema, ColumnType } from '@forestadmin/datasource-cached';
import { Client } from '@hubspot/api-client';

import { HubSpotOptions } from './types';

async function getCollectionSchema(
  client: Client,
  collectionName: string,
  fields: string[],
): Promise<CachedCollectionSchema> {
  const collection: CachedCollectionSchema = {
    name: collectionName,
    fields: {
      id: { type: 'Column', columnType: 'String', isPrimaryKey: true },
    },
  };

  const properties = await client.crm.properties.coreApi.getAll(collectionName);

  for (const fieldName of fields) {
    const property = properties.results.find(p => p.name === fieldName);
    if (!property) throw new Error(`property ${fieldName} does not exists`);

    let columnType: ColumnType;
    if (property.type === 'string') columnType = 'String';
    else throw new Error(`property ${fieldName} has unsupported type ${property.type}`);

    collection.fields[fieldName] = { type: 'Column', columnType, isPrimaryKey: false };
  }

  return collection;
}

export default async function getSchema(client: Client, options: HubSpotOptions) {
  return Promise.all(
    Object.entries(options.collections).map(([collectionName, fields]) =>
      getCollectionSchema(client, collectionName, fields),
    ),
  );
}
