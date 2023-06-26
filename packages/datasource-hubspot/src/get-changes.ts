/* eslint-disable */
import { SynchronizeOutput } from '@forestadmin/datasource-cached';
import { Client } from '@hubspot/api-client';
import { HubSpotOptions, State } from './types';

const pageSize = 100;

export default async function getChanges(
  client: Client,
  options: HubSpotOptions,
  name: string,
  state: State,
): Promise<SynchronizeOutput<State>> {
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
    more: records,
    deletedRecords: [],
    done: records.length < pageSize,
    newState: response.results.at(-1)?.properties.lastmodifieddate ?? state,
  };
}
