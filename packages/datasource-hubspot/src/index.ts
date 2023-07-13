/* eslint-disable import/prefer-default-export */
import { createCachedDataSource } from '@forestadmin/datasource-cached';
import { Logger } from '@forestadmin/datasource-toolkit';
import { Client } from '@hubspot/api-client';

import { HUBSPOT_COLLECTIONS } from './constants';
import getChanges from './get-changes';
import getFieldsPropertiesByCollections from './get-fields-properties';
import getSchema from './schema';
import { HubSpotOptions } from './types';
import writeCollectionsTypeFileIfChange from './write-collections-type-file';

export async function createHubspotDataSource<TypingsHubspot>(
  options: HubSpotOptions<TypingsHubspot>,
) {
  return async (logger: Logger) => {
    const client = new Client({ accessToken: options.accessToken });
    const fieldsProperties = await getFieldsPropertiesByCollections(
      client,
      HUBSPOT_COLLECTIONS,
      logger,
    );

    if (!options.skipTypings) {
      const path = options.typingsPath ?? 'src/typings-hubspot.ts';
      writeCollectionsTypeFileIfChange(fieldsProperties, path, logger);
    }

    const factory = createCachedDataSource({
      cacheNamespace: 'hubspot',
      schema: getSchema(fieldsProperties, options.collections, logger),
      // Use delta synchronization
      pullDeltaHandler: request => getChanges(client, options, request, logger),
      pullDeltaOnRestart: true,
      pullDeltaOnBeforeAccess: true,
      pullDeltaOnBeforeAccessDelay: 100,
      cacheInto: options.cacheInto,
    });

    return factory(logger);
  };
}
