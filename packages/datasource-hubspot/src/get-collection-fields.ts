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
