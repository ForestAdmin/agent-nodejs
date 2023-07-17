import { PullDeltaRequest, PullDeltaResponse } from '@forestadmin/datasource-cached';
import { Logger } from '@forestadmin/datasource-toolkit';
import { Client } from '@hubspot/api-client';

import {
  deleteRecordsIfNotExist,
  pullNewRelationRecords,
  pullUpdatedOrNewRecords,
  updateRelationRecords,
} from './get-changes';
import { getManyToManyRelationNames } from './relations';
import { HubSpotOptions, Response } from './types';

export default async function pullDelta<TypingsHubspot>(
  client: Client,
  options: HubSpotOptions<TypingsHubspot>,
  request: PullDeltaRequest,
  logger?: Logger,
): Promise<PullDeltaResponse> {
  const relations = getManyToManyRelationNames(request.collections);
  const collections = request.collections.filter(c => !relations.includes(c));
  const response: Response = {
    more: false,
    // save the previous delta state
    nextState: { ...((request.previousDeltaState as object) ?? {}) },
    newOrUpdatedEntries: [],
    deletedEntries: [],
  };

  const deltaResponsePromises: Array<Promise<void>> = [
    ...pullUpdatedOrNewRecords<TypingsHubspot>(
      client,
      collections,
      request.previousDeltaState,
      options,
      response,
    ),
  ];

  // update the records that the user is tying to read
  if (request.reasons.map(r => r.name).includes('before-list')) {
    const beforeListReasons = request.reasons.filter(reason => reason.name === 'before-list');

    const reasonsOnRelationsToUpdate = beforeListReasons.filter(reason =>
      relations.includes(reason.collection),
    );
    const reasonsOnCollectionsToUpdate = beforeListReasons.filter(
      reason => !relations.includes(reason.collection),
    );

    const relationsToUpdate = {};
    await Promise.all(
      reasonsOnRelationsToUpdate.map(async reason => {
        const id = `${reason.collection.split('_')[0]}_id`;
        const recordIds = await request.cache
          .getCollection(reason.collection)
          .list(reason.filter, [id]);

        relationsToUpdate[reason.collection] = recordIds.map(r => r[id]);
      }),
    );
    const recordsToUpdate = {};
    await Promise.all(
      reasonsOnCollectionsToUpdate.map(async reason => {
        const recordIds = await request.cache
          .getCollection(reason.collection)
          .list(reason.filter, ['id']);

        recordsToUpdate[reason.collection] = recordIds.map(r => r.id);
      }),
    );

    deltaResponsePromises.push(
      updateRelationRecords(client, relationsToUpdate, response),
      deleteRecordsIfNotExist(client, recordsToUpdate, response),
    );
  }

  if (request.reasons.map(r => r.name).includes('startup')) {
    deltaResponsePromises.push(...pullNewRelationRecords(client, relations, request, response));
  }

  await Promise.all(deltaResponsePromises);
  if (response.more === false) logger?.('Info', 'All the records are updated');
  if (response.deletedEntries.length > 0) logger?.('Info', 'Some records have been deleted');

  return { ...response, nextDeltaState: response.nextState };
}
