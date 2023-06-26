import { CachedCollectionSchema, DataType, DataTypes } from '@forestadmin/datasource-cached';
import { Client } from '@hubspot/api-client';

import { HubSpotOptions } from './types';

async function getCollectionSchema(
  client: Client,
  collectionName: string,
  fields: string[],
): Promise<CachedCollectionSchema> {
  const collection: CachedCollectionSchema = {
    name: collectionName,
    columns: {
      id: { columnType: DataTypes.STRING, isPrimaryKey: true },
    },
  };

  const properties = await client.crm.properties.coreApi.getAll(collectionName);

  for (const fieldName of fields) {
    const property = properties.results.find(p => p.name === fieldName);
    if (!property) throw new Error(`property ${fieldName} does not exists`);

    let type: DataType;
    if (property.type === 'string') type = DataTypes.STRING;
    else throw new Error(`property ${fieldName} has unsupported type ${property.type}`);

    collection.columns[fieldName] = { columnType: type, isPrimaryKey: false };
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
