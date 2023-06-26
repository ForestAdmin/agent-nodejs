/* eslint-disable import/prefer-default-export */
import { createCachedDataSource } from '@forestadmin/datasource-cached';
import { Client } from '@hubspot/api-client';

import getChanges from './get-changes';
import getSchema from './schema';
import { HubSpotOptions, State } from './types';

export function createHubspotDataSource(options: HubSpotOptions) {
  const client = new Client({ accessToken: options.accessToken });

  return createCachedDataSource<State>({
    namespace: 'hubspot',
    cacheInto: 'sqlite::memory:',
    schema: getSchema(client, options),
    getChanges: (name, state) => getChanges(client, options, name, state),
  });
}
