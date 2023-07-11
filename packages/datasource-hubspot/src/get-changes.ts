import { DeltaRequest, DeltaResponse } from '@forestadmin/datasource-cached';
import { Client } from '@hubspot/api-client';

import { RATE_LIMIT_SEARCH_REQUEST } from './constants';
import { HubSpotOptions } from './types';

/**
 * This seems to be the actual maximum page size (did not find it in the documentation).
 * @see https://community.hubspot.com/t5/HubSpot-Ideas/Increase-API-Response-Maximum-Page-Size-Maximum-Record-Count/idi-p/435453
 */
const pageSize = 100;

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
) {
  const response = await getDiscovery(client, collectionName).searchApi.doSearch({
    filterGroups: after
      ? [{ filters: [{ propertyName: 'lastmodifieddate', operator: 'GT', value: after }] }]
      : [],
    sorts: ['lastmodifieddate'],
    properties: fields,
    limit: pageSize,
    after: 0,
  });

  return response.results.map(r =>
    Object.fromEntries([['id', r.id], ...fields.map(f => [f, r.properties[f]])]),
  );
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
          Math.floor((index + 1) / RATE_LIMIT_SEARCH_REQUEST) * 1000,
        );
      });

      newOrUpdatedEntries.push(...records.map(r => ({ collection: name, record: r })));
      nextDeltaState[name] = records.at(-1)?.lastmodifieddate ?? after;
      more ||= records.length === pageSize;
    }),
  );

  return { more, nextDeltaState, newOrUpdatedEntries, deletedEntries: [] };
}
