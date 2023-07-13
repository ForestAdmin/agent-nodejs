import { PullDeltaRequest, PullDeltaResponse } from '@forestadmin/datasource-cached';
import { Logger } from '@forestadmin/datasource-toolkit';
import { Client } from '@hubspot/api-client';

import { HUBSPOT_MAX_PAGE_SIZE, HUBSPOT_RATE_LIMIT_SEARCH_REQUEST } from './constants';
import { getManyToManyRelationNames } from './relations';
import { HubSpotOptions } from './types';
import { executeAfterDelay } from './utils';

type Records = Record<string, any>[];

function getDiscovery(client: Client, collectionName: string) {
  if (collectionName === 'feedback_submissions') {
    return client.crm.objects.feedbackSubmissions;
  }

  if (collectionName === 'line_items') {
    return client.crm.lineItems;
  }

  return client.crm[collectionName];
}

async function getRecords(
  client: Client,
  collectionName: string,
  fields: string[],
  lastModifiedDate?: string,
): Promise<Records> {
  const discovery = getDiscovery(client, collectionName);
  const response = await discovery.searchApi.doSearch({
    filterGroups: lastModifiedDate
      ? [
          {
            filters: [
              { propertyName: 'hs_lastmodifieddate', operator: 'GT', value: lastModifiedDate },
            ],
          },
        ]
      : [],
    sorts: ['hs_lastmodifieddate'],
    properties: fields,
    limit: HUBSPOT_MAX_PAGE_SIZE,
    after: 0,
  });

  // TODO: CHECK IF THERE IS NO ERROR IN THE RESPONSE
  return response.results.map(r =>
    Object.fromEntries([
      ['id', r.id],
      ...fields.map(f => [f, r.properties[f]]),
      [
        'temporaryLastModifiedDate',
        r.properties.hs_lastmodifieddate ?? r.properties.lastmodifieddate,
      ],
    ]),
  );
}

async function getAllManyToManyRecords(
  client: Client,
  collectionName: string,
  after?: string,
): Promise<Records> {
  const [from, to] = collectionName.split('_');
  const response = await getDiscovery(client, from).basicApi.getPage(
    HUBSPOT_MAX_PAGE_SIZE,
    after,
    undefined,
    undefined,
    [to],
  );

  // TODO: CHECK IF THERE IS NO ERROR IN THE RESPONSE
  return response.results.reduce((records, fromResult) => {
    fromResult.associations?.[to].results.forEach(toResult => {
      records.push({ [`${from}_id`]: fromResult.id, [`${to}_id`]: toResult.id });
    });

    return records;
  }, []);
}

async function findRecords(
  client: Client,
  collectionName: string,
  recordsIds: string[],
  after: number,
): Promise<Records> {
  const response = await getDiscovery(client, collectionName).searchApi.doSearch({
    filterGroups: [
      { filters: [{ propertyName: 'hs_object_id', operator: 'IN', values: recordsIds }] },
    ],
    properties: ['hs_object_id'],
    limit: HUBSPOT_MAX_PAGE_SIZE,
    after,
  });

  // TODO: CHECK IF THERE IS NO ERROR IN THE RESPONSE
  return response.results.map(r => Object.fromEntries([['id', r.id]]));
}

function upsertAllRecords<TypingsHubspot>(
  client: Client,
  collectionNames: string[],
  request: PullDeltaRequest,
  options: HubSpotOptions<TypingsHubspot>,
  deltaResponse: PullDeltaResponse,
): Array<Promise<void>> {
  return collectionNames.map(async (name, index) => {
    const after = request.previousDeltaState?.[name];
    const fields = options.collections[name];

    // this is a workaround to avoid hitting the hubspot rate limit
    // waiting 1 second every RATE_LIMIT_SEARCH_REQUEST requests
    const records: Records = await executeAfterDelay<Records>(
      () => getRecords(client, name, fields, after),
      Math.floor((index + 1) / HUBSPOT_RATE_LIMIT_SEARCH_REQUEST) * 1000,
    );

    deltaResponse.nextDeltaState[name] = records.at(-1)?.temporaryLastModifiedDate ?? after;
    const processedRecords = records.map(record => {
      // remove the temporaryLastModifiedDate because it is not a real field.
      delete record.temporaryLastModifiedDate;

      return { collection: name, record };
    });
    deltaResponse.newOrUpdatedEntries.push(...processedRecords);
    deltaResponse.more ||= records.length === HUBSPOT_MAX_PAGE_SIZE;
  });
}

function insertNewRelationRecords(
  client: Client,
  relationNames: string[],
  request: PullDeltaRequest,
  deltaResponse: PullDeltaResponse,
) {
  return relationNames.map(async name => {
    const after = request.previousDeltaState?.[name];
    const records = await getAllManyToManyRecords(client, name, after);
    deltaResponse.newOrUpdatedEntries.push(
      ...records.map(record => ({ collection: name, record })),
    );
    deltaResponse.nextDeltaState[name] = (after ?? 0) + records.length;
    deltaResponse.more ||= records.length === HUBSPOT_MAX_PAGE_SIZE;
  });
}

async function updateRecordsByIds(
  client: Client,
  idsByCollection: [string, string[]][],
  deltaResponse: PullDeltaResponse,
): Promise<void> {
  for (const [collectionName, ids] of idsByCollection) {
    const promises = [];

    for (let i = 0; i < ids.length; i += 100) {
      promises.push(async () => {
        const existingIds: Records = await executeAfterDelay<Records>(
          () => findRecords(client, collectionName, ids.slice(i, i + 100), i),
          Math.floor((i + 1) / 100 / HUBSPOT_RATE_LIMIT_SEARCH_REQUEST) * 1000,
        );
        const recordsToDelete = existingIds.filter(r => !ids.includes(r.id));
        deltaResponse.deletedEntries.push(
          ...recordsToDelete.map(record => ({ collection: collectionName, record })),
        );
      });
    }

    // awaited ib the loop to avoid hitting the hubspot rate limit
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(promises.map(p => p()));
  }
}

// companies_contacts
// company_id 1 --- contact_id 2
// company_id 1 --- contact_id 3
// company_id 2 --- contact_id 3

// companies_deals
// company_id 1 --- deal_id 1
// company_id 1 --- deal_id 2
// company_id 2 --- deal_id 2

async function updateRelationRecordsByIds(
  client: Client,
  recordIdsByRelation: [string, Records[]][],
  deltaResponse: PullDeltaResponse,
): Promise<void> {
  for (const [relationName, recordsIds] of recordIdsByRelation) {
    const [from, to] = relationName.split('_');

    for (const ids of recordsIds) {
      const fromId = ids[`${from}_id`];

      // eslint-disable-next-line no-await-in-loop
      const fromRelation = await getDiscovery(client, from).basicApi.getById(
        fromId,
        undefined,
        undefined,
        [to],
      );
      const recordsToAdd = fromRelation.associations?.[to].results.map(record => ({
        [`${from}_id`]: fromRelation.id,
        [`${to}_id`]: record.id,
      }));
      deltaResponse.newOrUpdatedEntries.push(
        ...recordsToAdd.map(record => ({ collection: relationName, record })),
      );
      // remove all the records
      deltaResponse.deletedEntries.push({
        collection: relationName,
        record: { [`${from}_id`]: fromId },
      });
    }
  }
}

export default async function getDelta<TypingsHubspot>(
  client: Client,
  options: HubSpotOptions<TypingsHubspot>,
  request: PullDeltaRequest,
  logger?: Logger,
): Promise<PullDeltaResponse> {
  const relations = getManyToManyRelationNames(request.collections);
  const collections = request.collections.filter(c => !relations.includes(c));
  const deltaResponse: PullDeltaResponse = {
    more: false,
    // save the previous delta state
    nextDeltaState: { ...((request.previousDeltaState as object) ?? {}) },
    newOrUpdatedEntries: [],
    deletedEntries: [],
  };

  const deltaResponsePromises: Array<Promise<void>> = [
    ...upsertAllRecords<TypingsHubspot>(client, collections, request, options, deltaResponse),
  ];

  if (request.reasons.map(r => r.reason).includes('before-list')) {
    const idsToCheckIfAlreadyExists = request.reasons
      .filter(reason => reason.reason === 'before-list')
      .map(async reason => {
        const { filter, collections: col } = reason;

        const collectionToFetch = col[1] ?? col[0];
        const recordIds = await request.cache.getCollection(collectionToFetch).list(filter, ['id']);

        return [collectionToFetch, recordIds.map(r => r.id)] as [string, string[]];
      });

    deltaResponsePromises.push(
      updateRecordsByIds(client, await Promise.all(idsToCheckIfAlreadyExists), deltaResponse),
      updateRelationRecordsByIds(
        client,
        collectionAndRelations.filter(([name]) => relations.includes(name)),
        deltaResponse,
      ),
    );
  }

  if (request.reasons.map(r => r.reason).includes('startup')) {
    deltaResponsePromises.push(
      ...insertNewRelationRecords(client, relations, request, deltaResponse),
    );
  }

  await Promise.all(deltaResponsePromises);

  if (deltaResponse.more === false) logger?.('Info', 'All the records are updated');
  if (deltaResponse.deletedEntries.length > 0) logger?.('Info', 'Some records have been deleted');

  return deltaResponse;
}
