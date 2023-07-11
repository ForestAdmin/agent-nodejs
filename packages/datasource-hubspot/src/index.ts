/* eslint-disable import/prefer-default-export */
import { createCachedDataSource } from '@forestadmin/datasource-cached';
import { Logger } from '@forestadmin/datasource-toolkit';
import { Client } from '@hubspot/api-client';
import * as fs from 'fs';

import ALLOWED_COLLECTIONS from './constants';
import getChanges from './get-changes';
import getSchema from './schema';
import { HubSpotOptions } from './types';
import writeCollectionTypesFile from './write-collection-types-file';

export async function createHubspotDataSource<TypingsHubspot>(
  options: HubSpotOptions<TypingsHubspot>,
) {
  return async (logger: Logger) => {
    const client = new Client({ accessToken: options.accessToken });

    if (!options.skipTypings) {
      await writeCollectionTypesFile(client, ALLOWED_COLLECTIONS, '/tmp/typingsPath.ts', logger);
      const newTypings = fs.readFileSync('/tmp/typingsPath.ts', 'utf-8');
      const oldTypings = fs.readFileSync(options.typingsPath ?? 'typings-hubspot.ts', {
        encoding: 'utf-8',
        flag: 'a+', // create file if not exists
      });

      // avoid to write the same content
      if (oldTypings !== newTypings) {
        logger?.('Info', 'Generating collection types');
        fs.writeFileSync(options.typingsPath, newTypings);
        logger('Info', 'Collection types generated');
      }
    }

    const factory = createCachedDataSource({
      cacheInto: 'sqlite::memory:',
      cacheNamespace: 'hubspot',
      schema: getSchema(client, options.collections, logger),
      // Use delta synchronization
      getDelta: request => getChanges(client, options, request),
      deltaOnStartup: true,
      deltaOnBeforeAccess: true,
      deltaAccessDelay: 50,
    });

    return factory(logger);
  };
}
