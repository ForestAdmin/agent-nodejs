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
    schema: getSchema(client, options.collections),

    // Use delta synchronization
    getDelta: request => getChanges(client, options, request),
    deltaOnStartup: true,
    deltaOnBeforeAccess: true,
    deltaAccessDelay: 50,
  });
}
