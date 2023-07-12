import { PullDeltaRequest, PullDeltaResponse } from '@forestadmin/datasource-cached';
import { Client } from '@hubspot/api-client';

import { HUBSPOT_MAX_PAGE_SIZE, HUBSPOT_RATE_LIMIT_SEARCH_REQUEST } from './constants';
import { getManyToManyRelationNames } from './relations';
import { HubSpotOptions } from './types';

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
  after?: string,
): Promise<Records> {
  const discovery = getDiscovery(client, collectionName);
  const response = await discovery.searchApi.doSearch({
    filterGroups: after
      ? [{ filters: [{ propertyName: 'lastmodifieddate', operator: 'GT', value: after }] }]
      : [],
    sorts: ['lastmodifieddate'],
    properties: fields,
    limit: HUBSPOT_MAX_PAGE_SIZE,
    after: 0,
  });

  // TODO: CHECK IF THERE IS NO ERROR IN THE RESPONSE
  return response.results.map(r =>
    Object.fromEntries([['id', r.id], ...fields.map(f => [f, r.properties[f]])]),
  );
}

async function getManyToManyRecords(
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

export default async function getDelta<TypingsHubspot>(
  client: Client,
  options: HubSpotOptions<TypingsHubspot>,
  request: PullDeltaRequest,
): Promise<PullDeltaResponse> {
  const manyToManyRelations = getManyToManyRelationNames(request.collections);
  const collectionsWithoutManyToMany = request.collections.filter(
    c => !manyToManyRelations.includes(c),
  );

  const newOrUpdatedEntries = [];
  const nextDeltaState = { ...((request.previousDeltaState as object) ?? {}) };

  let more = false;

  if (request.reasons.map(r => r.reason).includes('startup')) {
    const collectionsPromises = collectionsWithoutManyToMany.map(async (collectionName, index) => {
      const after = request.previousDeltaState?.[collectionName];
      const fields = options.collections[collectionName];

      // this is a workaround to avoid hitting the hubspot rate limit
      // waiting 1 second every RATE_LIMIT_SEARCH_REQUEST requests
      const records: Records = await new Promise(resolve => {
        setTimeout(
          () => getRecords(client, collectionName, fields, after).then(resolve),
          Math.floor((index + 1) / HUBSPOT_RATE_LIMIT_SEARCH_REQUEST) * 1000,
        );
      });

      newOrUpdatedEntries.push(...records.map(record => ({ collection: collectionName, record })));
      nextDeltaState[collectionName] = records.at(-1)?.lastmodifieddate ?? after;
      more ||= records.length === HUBSPOT_MAX_PAGE_SIZE;
    });

    await Promise.all([
      ...collectionsPromises,
      ...manyToManyRelations.map(async collectionName => {
        const after = request.previousDeltaState?.[collectionName];
        const records = await getManyToManyRecords(client, collectionName, after);
        newOrUpdatedEntries.push(
          ...records.map(record => ({ collection: collectionName, record })),
        );
        nextDeltaState[collectionName] = records.at(-1)?.lastmodifieddate ?? after;
        more ||= records.length === HUBSPOT_MAX_PAGE_SIZE;
      }),
    ]);
  } else if (request.reasons.map(r => r.reason).includes('timer')) {
    await Promise.all(
      manyToManyRelations.map(async collectionName => {
        const after = request.previousDeltaState?.[collectionName];
        const records = await getManyToManyRecords(client, collectionName, after);
        newOrUpdatedEntries.push(
          ...records.map(record => ({ collection: collectionName, record })),
        );
        nextDeltaState[collectionName] = records.at(-1)?.lastmodifieddate ?? after;
        more ||= records.length === HUBSPOT_MAX_PAGE_SIZE;
      }),
    );
  }

  // TODO FAIRE LA SUPPRESSION DES DELETED ENTRIES
  return { more, nextDeltaState, newOrUpdatedEntries, deletedEntries: [] };
}
