/* eslint-disable import/prefer-default-export */
import { createCachedDataSource } from '@forestadmin/datasource-cached';
import { Client } from '@hubspot/api-client';

import getChanges from './get-changes';
import getSchema from './schema';
import { HubSpotOptions } from './types';

export function createHubspotDataSource(options: HubSpotOptions) {
  const client = new Client({ accessToken: options.accessToken });

  return createCachedDataSource({
    namespace: 'hubspot',
    cacheInto: 'sqlite::memory:',
    schema: getSchema(client, options),

    // Use delta synchronization
    getDelta: request => getChanges(client, options, request),
    deltaOnBeforeList: true,
    deltaOnBeforeAggregate: true,
  });
}
