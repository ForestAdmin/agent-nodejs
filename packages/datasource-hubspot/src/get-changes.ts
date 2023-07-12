import { DeltaRequest, DeltaResponse } from '@forestadmin/datasource-cached';
import { Client } from '@hubspot/api-client';

import { HUBSPOT_MAX_PAGE_SIZE, HUBSPOT_RATE_LIMIT_SEARCH_REQUEST } from './constants';
import { HubSpotOptions } from './types';

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
): Promise<Record<string, any>[]> {
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

  return response.results.map(r =>
    Object.fromEntries([['id', r.id], ...fields.map(f => [f, r.properties[f]])]),
  );

  // fetch all the relations here with the associations with batch read
  // groupd by collection type
  // fetch the relations
  // discovery.batchApi.getPage({ limit: pageSize, after: 0 });
}

export default async function getDelta<TypingsHubspot>(
  client: Client,
  options: HubSpotOptions<TypingsHubspot>,
  request: DeltaRequest,
): Promise<DeltaResponse> {
  const newOrUpdatedEntries = [];
  const nextDeltaState = { ...((request.previousDeltaState as object) ?? {}) };

  let more = false;

  await Promise.all(
    request.collections.map(async (name, index) => {
      const after = request.previousDeltaState?.[name];
      const fields = options.collections[name];

      // this is a workaround to avoid hitting the hubspot rate limit
      // waiting 1 second every RATE_LIMIT_SEARCH_REQUEST requests
      const records: Array<Record<string, any>> = await new Promise(resolve => {
        setTimeout(
          () => getRecords(client, name, fields, after).then(resolve),
          Math.floor((index + 1) / HUBSPOT_RATE_LIMIT_SEARCH_REQUEST) * 1000,
        );
      });

      newOrUpdatedEntries.push(...records.map(r => ({ collection: name, record: r })));
      nextDeltaState[name] = records.at(-1)?.lastmodifieddate ?? after;
      more ||= records.length === HUBSPOT_MAX_PAGE_SIZE;
    }),
  );

  // TODO FAIRE LA SUPPRESSION DES DELETED ENTRIES
  return { more, nextDeltaState, newOrUpdatedEntries, deletedEntries: [] };
}
