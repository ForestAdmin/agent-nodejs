/* eslint-disable import/prefer-default-export */
import { createCachedDataSource } from '@forestadmin/datasource-cached';
import { Logger } from '@forestadmin/datasource-toolkit';
import { Client } from '@hubspot/api-client';

import DEFAULT_COLLECTIONS from './constants';
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
      DEFAULT_COLLECTIONS,
      logger,
    );

    if (!options.skipTypings) {
      const path = options.typingsPath ?? 'src/typings-hubspot.ts';
      writeCollectionsTypeFileIfChange(fieldsProperties, path, logger);
    }

    const factory = createCachedDataSource({
      cacheInto: 'sqlite::memory:',
      cacheNamespace: 'hubspot',
      schema: getSchema(fieldsProperties, options.collections, logger),
      // Use delta synchronization
      getDelta: request => getChanges(client, options, request),
      deltaOnStartup: true,
      deltaOnBeforeAccess: true,
      deltaAccessDelay: 50,
    });

    return factory(logger);
  };
}
