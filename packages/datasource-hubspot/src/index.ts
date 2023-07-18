/* eslint-disable import/prefer-default-export */
import { createCachedDataSource } from '@forestadmin/datasource-cached';
import { Logger } from '@forestadmin/datasource-toolkit';
import { Client } from '@hubspot/api-client';

import { getFieldsProperties } from './hubspot-api';
import pullDelta from './pull-delta';
import pullDump from './pull-dump';
import getSchema from './schema';
import { HubSpotOptions } from './types';
import validateCollectionsProperties from './validator';
import writeCollectionsTypeFileIfChange from './write-collections-type-file';

export async function createHubspotDataSource<TypingsHubspot>(
  options: HubSpotOptions<TypingsHubspot>,
) {
  return async (logger: Logger) => {
    const client = new Client({ accessToken: options.accessToken });
    const collectionNames = Object.keys(options.collections);
    const fieldsProperties = await getFieldsProperties(client, collectionNames, logger);
    validateCollectionsProperties(options.collections, fieldsProperties);

    if (!options.skipTypings) {
      const path = options.typingsPath ?? 'src/typings-hubspot.ts';
      writeCollectionsTypeFileIfChange(fieldsProperties, path, logger);
    }

    const factory = createCachedDataSource({
      cacheNamespace: 'hubspot',
      schema: getSchema(fieldsProperties, options.collections, logger),
      pullDeltaHandler: request => pullDelta(client, options, request, logger),
      pullDumpHandler: request => pullDump<TypingsHubspot>(client, options, request, logger),
      pullDeltaOnRestart: true,
      pullDeltaOnBeforeAccess: true,
      pullDeltaOnBeforeAccessDelay: 100,
      cacheInto: options.cacheInto,
      pullDumpOnSchedule: options.pullDumpOnSchedule,
    });

    return factory(logger);
  };
}
