import { Logger } from '@forestadmin/datasource-toolkit';
import { Client } from '@hubspot/api-client';

import { HUBSPOT_CUSTOM_COLLECTION } from './constants';
import { FieldPropertiesByCollection } from './types';

function handleErrors(error: Error & { code: number }, collectionName: string, logger?: Logger) {
  if (error.code === 429) {
    // to much requests
    logger?.(
      'Warn',
      `Unable to get properties for collection ${collectionName}` +
        ' because we have reached the limit of requests in one second. Please try again.',
    );
  } else if (error.code === 403) {
    logger?.('Warn', `Unable to get properties for collection "${collectionName}".`);
  } else {
    throw error;
  }
}

export default async function getFieldsPropertiesByCollections(
  client: Client,
  collections: string[],
  logger?: Logger,
): Promise<FieldPropertiesByCollection> {
  const fieldsByCollection = {};

  const promises = collections.map(async collectionName => {
    try {
      if (collectionName === HUBSPOT_CUSTOM_COLLECTION) {
        // todo: get all the custom collections
        //  await client.crm.schemas.coreApi.getAll(false);
      } else {
        const { results } = await client.crm.properties.coreApi.getAll(collectionName);
        fieldsByCollection[collectionName] = results;
      }
    } catch (e) {
      handleErrors(e, collectionName, logger);
    }
  });

  await Promise.all(promises);

  return fieldsByCollection;
}
