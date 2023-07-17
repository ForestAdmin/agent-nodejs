import { PullDumpRequest, PullDumpResponse } from '@forestadmin/datasource-cached';
import { Logger } from '@forestadmin/datasource-toolkit';
import { Client } from '@hubspot/api-client';

import { pullRecordsAndRelations } from './get-changes';
import { getManyToManyRelationNames } from './relations';
import { HubSpotOptions, Response } from './types';

export default async function pullDump<TypingsHubspot>(
  client: Client,
  options: HubSpotOptions<TypingsHubspot>,
  request: PullDumpRequest,
  logger?: Logger,
): Promise<PullDumpResponse> {
  const relations = getManyToManyRelationNames(Object.keys(options.collections));
  const response: Response = {
    more: false,
    nextState: { ...((request.previousDumpState as object) ?? {}) },
    newOrUpdatedEntries: [],
    deletedEntries: [],
  };

  const collectionWithRelations = relations.reduce((acc, collectionName) => {
    const [from, to] = collectionName.split('_');
    acc[from] = acc[from] ?? [];
    acc[from]?.push(to);

    return acc;
  }, {});

  await Promise.all(
    pullRecordsAndRelations(
      client,
      collectionWithRelations,
      options.collections as Record<string, string[]>,
      request.previousDumpState,
      response,
    ),
  );
  if (response.more === false) logger?.('Info', 'All the records are updated');

  // save the date of the last dump to the next delta state
  const nextDeltaState = Object.keys(options.collections).reduce((acc, collectionName) => {
    acc[collectionName] = new Date().toISOString();

    return acc;
  }, {});

  return {
    ...response,
    entries: response.newOrUpdatedEntries,
    nextDumpState: response.nextState,
    nextDeltaState,
  };
}
