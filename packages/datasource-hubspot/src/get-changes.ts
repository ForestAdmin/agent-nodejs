import { Client } from '@hubspot/api-client';

import {
  HUBSPOT_MAX_PAGE_SIZE,
  HUBSPOT_RATE_LIMIT_FILTER_VALUES,
  HUBSPOT_RATE_LIMIT_SEARCH_REQUEST,
} from './constants';
import {
  getExistingRecordIds,
  getLastModifiedRecords,
  getRecordsAndRelations,
  getRelations,
} from './hubspot-api';
import { HubSpotOptions, Records, Response } from './types';
import { executeAfterDelay } from './utils';

export async function pullUpdatedOrNewRecords<TypingsHubspot>(
  client: Client,
  collectionNames: string[],
  previousState: unknown,
  options: HubSpotOptions<TypingsHubspot>,
  response: Response,
): Promise<void> {
  const promises = collectionNames.map(async (name, index) => {
    const after = previousState?.[name];
    const fields = options.collections[name];

    // this is a workaround to avoid hitting the hubspot rate limit
    // waiting 1 second every RATE_LIMIT_SEARCH_REQUEST requests
    const records: Records = await executeAfterDelay<Records>(
      () => getLastModifiedRecords(client, name, fields, after),
      Math.floor((index + 1) / HUBSPOT_RATE_LIMIT_SEARCH_REQUEST) * 1000,
    );

    response.nextState[name] = records.at(-1)?.temporaryLastModifiedDate ?? after;
    const processedRecords = records.map(record => {
      // remove the temporaryLastModifiedDate because it is not a real field.
      delete record.temporaryLastModifiedDate;

      return { collection: name, record };
    });
    response.newOrUpdatedEntries.push(...processedRecords);
    response.more ||= records.length === HUBSPOT_MAX_PAGE_SIZE;
  });

  await Promise.all(promises);
}

export async function pullRecordsAndRelations(
  client: Client,
  relations: { [collectionName: string]: string[] },
  properties: { [collectionName: string]: string[] },
  previousState: unknown,
  response: Response,
): Promise<void> {
  const promises = Object.keys(relations).map(async collectionName => {
    const afterId = previousState?.[collectionName];
    const records = await getRecordsAndRelations(
      client,
      collectionName,
      relations[collectionName],
      properties[collectionName],
      afterId,
    );

    Object.entries(records).forEach(([collection, data]) => {
      response.newOrUpdatedEntries.push(...data.map(record => ({ collection, record })));
    });

    const lastId = records[collectionName]?.at(-1)?.id;
    response.nextState[collectionName] = lastId ? Number(lastId) + 1 : afterId;
    response.more ||= records[collectionName]?.length === HUBSPOT_MAX_PAGE_SIZE;
  });

  await Promise.all(promises);
}

export async function deleteRecordsIfNotExist(
  client: Client,
  idsByCollection: { [collectionName: string]: string[] },
  response: Response,
): Promise<void> {
  for (const [collectionName, ids] of Object.entries(idsByCollection)) {
    const promises = [];

    // make a bach of X requests to avoid hitting the hubspot rate limit
    for (let i = 0; i < ids.length; i += HUBSPOT_RATE_LIMIT_FILTER_VALUES) {
      promises.push(async () => {
        const existingIds: string[] = await executeAfterDelay<string[]>(
          () =>
            getExistingRecordIds(
              client,
              collectionName,
              ids.slice(i, i + HUBSPOT_RATE_LIMIT_FILTER_VALUES),
            ),
          Math.floor(
            (i + 1) / HUBSPOT_RATE_LIMIT_FILTER_VALUES / HUBSPOT_RATE_LIMIT_SEARCH_REQUEST,
          ) * 1000,
        );

        // find the records that have been deleted on hubspot
        const idsToDelete = ids.filter(id => !existingIds.includes(id));
        response.deletedEntries.push(
          ...idsToDelete.map(id => ({ collection: collectionName, record: { id } })),
        );
      });
    }

    // awaited in the loop to avoid hitting the hubspot rate limit
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(promises.map(p => p()));
  }
}

export async function updateRelationRecords(
  client: Client,
  recordIdsByRelation: { [relationName: string]: string[] },
  response: Response,
): Promise<void> {
  const promises: Array<() => void> = [];
  Object.entries(recordIdsByRelation).forEach(([relationName, ids]) => {
    const [from, to] = relationName.split('_');

    // Using set, to remove the duplicated id to avoid multiple requests
    for (const id of new Set(ids)) {
      promises.push(async () => {
        const relationIds = await getRelations(client, id, from, to);
        // build the relations tom make it compatible with the forest format
        const relations = relationIds.map(rId => ({ [`${from}_id`]: id, [`${to}_id`]: rId }));

        // these two steps will remove all the relations and then add the new ones
        // insert all the relations
        response.newOrUpdatedEntries.push(
          ...relations.map(record => ({ collection: relationName, record })),
        );
        // remove all the relations
        response.deletedEntries.push({ collection: relationName, record: { [`${from}_id`]: id } });
      });
    }

    return Promise.all(promises.map(p => p()));
  });
}
