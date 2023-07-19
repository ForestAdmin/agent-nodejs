import { PullDumpRequest, PullDumpResponse } from '@forestadmin/datasource-replica';
import { Logger } from '@forestadmin/datasource-toolkit';
import { Client } from '@hubspot/api-client';

import { pullRecordsAndRelations } from './changes';
import { getRelationsByCollection } from './relations';
import { HubSpotOptions, Response } from './types';

/**
 * example:
 * input: { contacts: ['companies', 'deals'], companies: ['contacts', 'deals'] }
 * 'deals' must removed from 'companies' to avoid to fetch 'companies-deals' relations twice.
 * output: { contacts: ['companies', 'deals'], companies: ['contacts'] }
 */
function buildUniqueRelations(relationsByCollection: { [collectionName: string]: string[] }): {
  [collectionName: string]: string[];
} {
  const relations = {};
  Object.entries(relationsByCollection).forEach(([collectionName, relationNames]) => {
    relationNames.forEach(relationName => {
      if (!relations[collectionName]) relations[collectionName] = [];

      if (relations[relationName]) {
        if (!relations[relationName].find(r => r === collectionName)) {
          relations[collectionName].push(relationName);
        }
      } else {
        relations[collectionName].push(relationName);
      }
    });
  });

  return relations;
}

export default async function pullDump<TypingsHubspot>(
  client: Client,
  options: HubSpotOptions<TypingsHubspot>,
  request: PullDumpRequest,
  logger?: Logger,
): Promise<PullDumpResponse> {
  const response: Response = {
    more: false,
    nextState: { ...((request.previousDumpState as object) ?? {}) },
    newOrUpdatedEntries: [],
    deletedEntries: [],
  };

  await pullRecordsAndRelations(
    client,
    buildUniqueRelations(getRelationsByCollection(Object.keys(options.collections))),
    options.collections as Record<string, string[]>,
    request.previousDumpState,
    response,
  );
  logger?.('Info', `Current dump state: ${JSON.stringify(request.previousDumpState)}`);
  if (response.more === false) logger?.('Info', 'All records have been pulled.');

  // save the date of the last dump to the next delta state
  const nextDeltaState = {};
  Object.keys(options.collections).forEach(collectionName => {
    nextDeltaState[collectionName] = new Date().toISOString();
  });

  return {
    ...response,
    entries: response.newOrUpdatedEntries,
    nextDumpState: response.nextState,
    nextDeltaState,
  };
}
