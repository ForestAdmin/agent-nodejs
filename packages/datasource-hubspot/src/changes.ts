import { Client } from '@hubspot/api-client';

import {
  HUBSPOT_MAX_PAGE_SIZE,
  HUBSPOT_RATE_LIMIT_FILTER_VALUES,
  HUBSPOT_RATE_LIMIT_SEARCH_REQUEST_BY_SECOND,
} from './constants';
import {
  fetchExistingRecordIds,
  fetchRecordsAndRelationships,
  fetchRelationshipsOfRecord,
  getLastModifiedRecords,
} from './hubspot-api';
import { getRelatedManyToManyNames } from './relationships';
import { HubSpotOptions, RecordWithRelationships, Records, Response } from './types';
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
    const records: Records = await executeAfterDelay<Records>(
      () => getLastModifiedRecords(client, name, fields, after),
      Math.floor((index + 1) / HUBSPOT_RATE_LIMIT_SEARCH_REQUEST_BY_SECOND) * 1000,
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

export async function pullRecordsAndRelationships(
  client: Client,
  relations: { [collectionName: string]: string[] },
  properties: { [collectionName: string]: string[] },
  previousState: unknown,
  response: Response,
): Promise<void> {
  const promises = Object.keys(properties).map(async collectionName => {
    const afterId = previousState?.[collectionName];
    const records = await fetchRecordsAndRelationships(
      client,
      collectionName,
      properties[collectionName],
      relations[collectionName],
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

export async function checkRecordsAndRelationships(
  client: Client,
  idsByCollection: { [collectionName: string]: string[] },
  availableCollections: string[],
  response: Response,
): Promise<void> {
  for (const [collectionName, ids] of Object.entries(idsByCollection)) {
    const relations = getRelatedManyToManyNames(collectionName, availableCollections);

    // make a bach requests to avoid hitting the hubspot rate limit
    const promises = Array.from({
      // build an array of the number of bach requests to make
      // For example, if ids.length = 5 and HUBSPOT_RATE_LIMIT_FILTER_VALUES = 2
      // the array will have a length of 3. Math.ceil(5 / 2) = 3
      length: Math.ceil(ids.length / HUBSPOT_RATE_LIMIT_FILTER_VALUES),
    }).map((_, i) => {
      return executeAfterDelay<string[]>(
        () =>
          fetchExistingRecordIds(
            client,
            collectionName,
            ids.slice(
              i * HUBSPOT_RATE_LIMIT_FILTER_VALUES,
              i * HUBSPOT_RATE_LIMIT_FILTER_VALUES + HUBSPOT_RATE_LIMIT_FILTER_VALUES,
            ),
          ),
        // For example, if HUBSPOT_RATE_LIMIT_SEARCH_REQUEST_BY_SECOND = 3
        // if i = 0, the bach request is delayed by 0 second. Math.floor(0 / 3) * 1000 = 0
        // if i = 1, the bach request is delayed by 0 second. Math.floor(1 / 3) * 1000 = 0
        // if i = 2, the bach request is delayed by 0 second. Math.floor(2 / 3) * 1000 = 0

        // if i = 3, the bach request is delayed by 1 second. Math.floor(3 / 3) * 1000 = 1000
        // if i = 4, the bach request is delayed by 1 second. Math.floor(4 / 3) * 1000 = 1000
        // if i = 5, the bach request is delayed by 1 second. Math.floor(5 / 3) * 1000 = 1000

        // if i = 6, the bach request is delayed by 2 second. Math.floor(6 / 3) * 1000 = 2000
        // etc
        Math.floor(i / HUBSPOT_RATE_LIMIT_SEARCH_REQUEST_BY_SECOND) * 1000,
      );
    });

    // awaited in the loop to avoid hitting the hubspot rate limit
    // eslint-disable-next-line no-await-in-loop
    const existingIds = (await Promise.all(promises)).flat();

    // find the records that have been deleted on hubspot
    ids.forEach(id => {
      if (existingIds.includes(id)) return;
      // delete records
      response.deletedEntries.push({ collection: collectionName, record: { id } });
      // delete relations
      relations.forEach(relation => {
        response.deletedEntries.push({
          collection: relation,
          record: { [`${collectionName}_id`]: id },
        });
      });
    });
  }
}

export async function updateRelationships(
  client: Client,
  records: RecordWithRelationships[],
  response: Response,
): Promise<void> {
  await Promise.all(
    records.map(async record => {
      const manyToManyRelations = getRelatedManyToManyNames(record.collectionName, [
        record.collectionName,
        ...record.relationships,
      ]);
      // remove all the relations related to the record
      manyToManyRelations.forEach(manyToManyName => {
        response.deletedEntries.push({
          collection: manyToManyName,
          record: { [`${record.collectionName}_id`]: record.id },
        });
      });

      const relationIds = await fetchRelationshipsOfRecord(
        client,
        record.id,
        record.collectionName,
        record.relationships,
      );

      // build all the relations
      Object.entries(relationIds).forEach(([relationName, ids]) => {
        const [manyToManyName] = getRelatedManyToManyNames(record.collectionName, [
          record.collectionName,
          relationName,
        ]);
        ids.forEach(id =>
          response.newOrUpdatedEntries.push({
            collection: manyToManyName,
            record: {
              [`${relationName}_id`]: id,
              [`${record.collectionName}_id`]: record.id,
            },
          }),
        );
      });
    }),
  );
}
