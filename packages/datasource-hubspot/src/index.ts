/* eslint-disable import/prefer-default-export */
import { createReplicaDataSource } from '@forestadmin/datasource-replica';
import { DataSourceFactory, Logger } from '@forestadmin/datasource-toolkit';
import { Client } from '@hubspot/api-client';

import { HUBSPOT_COLLECTIONS } from './constants';
import { fetchFieldsPropertiesByCollection } from './hubspot-api';
import pullDelta from './pull-delta';
import pullDump from './pull-dump';
import getSchema from './schema';
import { HubSpotOptions } from './types';
import generateTypesIfChange from './typing-generator';
import validateCollectionsProperties from './validator';

export { HubSpotOptions };

export function createHubspotDataSource<TypingsHubspot>(
  options: HubSpotOptions<TypingsHubspot>,
): DataSourceFactory {
  return async (logger: Logger) => {
    const client = new Client({ accessToken: options.accessToken });
    const fieldsProperties = await fetchFieldsPropertiesByCollection(
      client,
      HUBSPOT_COLLECTIONS,
      logger,
    );

    if (!options.skipTypings) {
      const path = options.typingsPath ?? 'src/typings-hubspot.ts';
      generateTypesIfChange(fieldsProperties, path, logger);
    }

    validateCollectionsProperties(options.collections, fieldsProperties);

    const factory = createReplicaDataSource({
      cacheNamespace: 'hubspot',
      schema: getSchema(fieldsProperties, options.collections, logger),
      pullDeltaHandler: request => pullDelta(client, options, request, logger),
      pullDumpHandler: request => pullDump<TypingsHubspot>(client, options, request, logger),
      pullDeltaOnRestart: true,
      pullDeltaOnBeforeAccess: true,
      pullDeltaOnBeforeAccessDelay: 50,
      cacheInto: options.cacheInto,
      pullDumpOnSchedule: options.pullDumpOnSchedule,
      pullDeltaOnSchedule: options.pullDeltaOnSchedule,
      pullDumpOnRestart: options.pullDumpOnRestart,
    });

    return factory(logger);
  };
}
