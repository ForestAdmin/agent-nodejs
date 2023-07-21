import { Client } from '@hubspot/api-client';

import {
  HUBSPOT_MAX_PAGE_SIZE,
  HUBSPOT_RATE_LIMIT_FILTER_VALUES,
  HUBSPOT_RATE_LIMIT_SEARCH_REQUEST,
} from './constants';
import {
  fetchExistingRecordIds,
  fetchRecordsAndRelations,
  fetchRelationOfRecord,
  getLastModifiedRecords,
} from './hubspot-api';
import { getManyToManyNamesOf } from './relations';
import { HubSpotOptions, RecordWithRelationNames, Records, Response } from './types';
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
  const promises = Object.keys(properties).map(async collectionName => {
    const afterId = previousState?.[collectionName];
    const records = await fetchRecordsAndRelations(
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

export async function deleteRecordsAndItsRelationIfDeleted(
  client: Client,
  idsByCollection: { [collectionName: string]: string[] },
  availableCollections: string[],
  response: Response,
): Promise<void> {
  for (const [collectionName, ids] of Object.entries(idsByCollection)) {
    const promises = [];

    // make a bach of HUBSPOT_RATE_LIMIT_FILTER_VALUES requests
    // to avoid hitting the hubspot rate limit
    for (let i = 0; i < ids.length; i += HUBSPOT_RATE_LIMIT_FILTER_VALUES) {
      promises.push(async () => {
        const existingIds: string[] = await executeAfterDelay<string[]>(
          () =>
            fetchExistingRecordIds(
              client,
              collectionName,
              ids.slice(i, i + HUBSPOT_RATE_LIMIT_FILTER_VALUES),
            ),
          Math.floor(
            (i + 1) / HUBSPOT_RATE_LIMIT_FILTER_VALUES / HUBSPOT_RATE_LIMIT_SEARCH_REQUEST,
          ) * 1000,
        );

        const relations = getManyToManyNamesOf(collectionName, availableCollections);
        // find the records that have been deleted on hubspot
        const idsToDelete = ids.filter(id => !existingIds.includes(id));
        idsToDelete.forEach(id => {
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
      });
    }

    // awaited in the loop to avoid hitting the hubspot rate limit
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(promises.map(p => p()));
  }
}

export async function updateRelations(
  client: Client,
  records: RecordWithRelationNames[],
  response: Response,
): Promise<void> {
  await Promise.all(
    records.map(async record => {
      const manyToManyRelations = getManyToManyNamesOf(record.collectionName, [
        record.collectionName,
        ...record.relations,
      ]);
      // remove all the relations related to the record
      manyToManyRelations.forEach(manyToManyName => {
        response.deletedEntries.push({
          collection: manyToManyName,
          record: { [`${record.collectionName}_id`]: record.id },
        });
      });

      const relationIds = await fetchRelationOfRecord(
        client,
        record.id,
        record.collectionName,
        record.relations,
      );

      // build all the relations
      Object.entries(relationIds).forEach(([relationName, ids]) => {
        const [manyToManyName] = getManyToManyNamesOf(record.collectionName, [
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
