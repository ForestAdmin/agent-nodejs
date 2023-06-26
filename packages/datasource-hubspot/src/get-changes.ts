import { SynchronizeOutput } from '@forestadmin/datasource-cached';
import { Client } from '@hubspot/api-client';

import { HubSpotOptions } from './types';

const pageSize = 100;

export default async function getChanges(
  client: Client,
  options: HubSpotOptions,
  name: string,
  state: unknown,
): Promise<SynchronizeOutput> {
  const response = await client.crm[name].searchApi.doSearch({
    filterGroups: state
      ? [{ filters: [{ propertyName: 'lastmodifieddate', operator: 'GT', value: state }] }]
      : [],
    sorts: ['lastmodifieddate'],
    properties: options.collections[name],
    limit: pageSize,
    after: 0,
  });

  const records = response.results.map(r =>
    Object.fromEntries([
      ['id', r.id],
      ...options.collections[name].map(fieldName => [fieldName, r.properties[fieldName]]),
    ]),
  );

  return {
    newOrUpdatedRecords: records,
    deletedRecords: [],
    more: records.length === pageSize,
    newState: response.results.at(-1)?.properties.lastmodifieddate ?? state,
  };
}
