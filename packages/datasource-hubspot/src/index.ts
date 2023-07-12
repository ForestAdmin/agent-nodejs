/* eslint-disable import/prefer-default-export */
import { createCachedDataSource } from '@forestadmin/datasource-cached';
import { Client } from '@hubspot/api-client';

import getChanges from './get-changes';
import getSchema from './schema';
import { HubSpotOptions } from './types';

export function createHubspotDataSource(options: HubSpotOptions) {
  const client = new Client({ accessToken: options.accessToken });

  return createCachedDataSource({
    cacheInto: 'sqlite::memory:',
    cacheNamespace: 'hubspot',
    schema: getSchema(client, options),

    // Use delta synchronization
    pullDeltaHandler: request => getChanges(client, options, request),
    pullDeltaOnRestart: true,
    pullDeltaOnBeforeAccess: true,
    pullDeltaOnBeforeAccessDelay: 50,
  });
}
