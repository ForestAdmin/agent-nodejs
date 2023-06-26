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

    syncStrategy: 'incremental',
    loadOnStart: ctx => getChanges(client, options, ctx.collection.name, null),
    syncOnBeforeList: ctx => getChanges(client, options, ctx.collection.name, ctx.state),
    syncOnBeforeAggregate: ctx => getChanges(client, options, ctx.collection.name, ctx.state),
  });
}
