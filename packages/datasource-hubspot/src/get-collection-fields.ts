import { Logger } from '@forestadmin/datasource-toolkit';
import { Client } from '@hubspot/api-client';

async function getCollectionTypes(
  client: Client,
  collectionName: string,
  logger?: Logger,
): Promise<string[] | undefined> {
  try {
    const properties = await client.crm.properties.coreApi.getAll(collectionName);

    return properties.results.map(property => property.name).sort((a, b) => a.localeCompare(b));
  } catch (e) {
    logger?.('Warn', `Unable to get properties for collection ${collectionName}`);
    logger?.('Warn', e.body.message);
  }
}

export default async function getCollectionFields(
  client: Client,
  collections: string[],
  logger?: Logger,
): Promise<Record<string, string[]>> {
  const fieldsByCollection: Record<string, string[]> = {};
  await Promise.all(
    collections.map(async collectionName => {
      const types = await getCollectionTypes(client, collectionName, logger);
      if (types) fieldsByCollection[collectionName] = types;
    }),
  );

  return fieldsByCollection;
}
