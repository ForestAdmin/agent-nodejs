import { PullDumpRequest, PullDumpResponse } from '@forestadmin/datasource-cached';
import { Logger } from '@forestadmin/datasource-toolkit';
import { Client } from '@hubspot/api-client';

import { pullRecordsAndRelations } from './get-changes';
import { getRelationsByCollection } from './relations';
import { HubSpotOptions, Response } from './types';

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
    getRelationsByCollection(Object.keys(options.collections)),
    options.collections as Record<string, string[]>,
    request.previousDumpState,
    response,
  );
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
