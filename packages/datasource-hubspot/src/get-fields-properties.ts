import { Logger } from '@forestadmin/datasource-toolkit';
import { Client } from '@hubspot/api-client';

import { FieldProperties, FieldPropertiesByCollection } from './types';

async function getProperties(
  client: Client,
  collectionName: string,
  logger?: Logger,
): Promise<FieldProperties> {
  try {
    const properties = await client.crm.properties.coreApi.getAll(collectionName);

    return properties.results;
  } catch (e) {
    if (e.code === 429) {
      // to much requests
      logger?.(
        'Warn',
        `Unable to get properties for collection ${collectionName}` +
          ' because we have reached the limit of requests in one second. Please try again.',
      );
    } else if (e.code === 403) {
      logger?.('Warn', `Unable to get properties for collection "${collectionName}".`);
    } else {
      throw e;
    }
  }
}

export default async function getFieldsPropertiesByCollections(
  client: Client,
  collections: string[],
  logger?: Logger,
): Promise<FieldPropertiesByCollection> {
  const fieldsByCollection = {};
  await Promise.all(
    collections.map(async collectionName => {
      const types = await getProperties(client, collectionName, logger);
      if (types) fieldsByCollection[collectionName] = types;
    }),
  );

  return fieldsByCollection;
}
