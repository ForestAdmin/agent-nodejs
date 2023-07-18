import { PullDeltaRequest, PullDeltaResponse } from '@forestadmin/datasource-replica';
import { Logger } from '@forestadmin/datasource-toolkit';
import { Client } from '@hubspot/api-client';

import {
  deleteRecordsIfNotExist,
  pullUpdatedOrNewRecords,
  pullUpdatedOrNewRelations,
} from './get-changes';
import { getRelationNames, getRelationsOf } from './relations';
import { HubSpotOptions, Response } from './types';

function getRelationsToUpdate(
  idsByCollection: {
    [collectionName: string]: string[];
  },
  availableCollections: string[],
): { id: string; relations: []; collectionName: string }[] {
  const relations = [];
  Object.entries(idsByCollection).forEach(([collectionName, ids]) => {
    ids.forEach(id => {
      relations.push({
        id,
        collectionName,
        relations: getRelationsOf(collectionName, availableCollections),
      });
    });
  });

  return relations;
}

async function getRecordsToDelete(
  cache,
  collections,
  reasons,
): Promise<{ [collectionName: string]: string[] }> {
  const reasonsOnCollectionsToUpdate = reasons.filter(reason =>
    collections.includes(reason.collection),
  );

  const recordsToUpdate = {};
  await Promise.all(
    reasonsOnCollectionsToUpdate.map(async reason => {
      const recordIds = await cache.getCollection(reason.collection).list(reason.filter, ['id']);

      recordsToUpdate[reason.collection] = recordIds.map(r => r.id);
    }),
  );

  return recordsToUpdate;
}

export default async function pullDelta<TypingsHubspot>(
  client: Client,
  options: HubSpotOptions<TypingsHubspot>,
  request: PullDeltaRequest,
  logger?: Logger,
): Promise<PullDeltaResponse> {
  const relations = getRelationNames(request.collections);
  const collections = request.collections.filter(c => !relations.includes(c));
  const response: Response = {
    more: false,
    // save the previous delta state
    nextState: { ...((request.previousDeltaState as object) ?? {}) },
    newOrUpdatedEntries: [],
    deletedEntries: [],
  };

  await pullUpdatedOrNewRecords<TypingsHubspot>(
    client,
    collections,
    request.previousDeltaState,
    options,
    response,
  );

  const idsByCollection = {};
  response.newOrUpdatedEntries.forEach(r => {
    if (!idsByCollection[r.collection]) idsByCollection[r.collection] = [];
    idsByCollection[r.collection].push(r.record.id);
  });
  // depending of the pullUpdatedOrNewRecord response
  await pullUpdatedOrNewRelations(
    client,
    getRelationsToUpdate(idsByCollection, Object.keys(options.collections)),
    response,
  );

  // delete the records the outdated records that the user is tying to read
  if (request.reasons.map(r => r.name).includes('before-list')) {
    const beforeListReasons = request.reasons.filter(reason => reason.name === 'before-list');
    await deleteRecordsIfNotExist(
      client,
      await getRecordsToDelete(request.cache, collections, beforeListReasons),
      response,
    );
  }

  if (response.more === false) logger?.('Info', 'All the records are updated');
  if (response.deletedEntries.length > 0) logger?.('Info', 'Some records have been deleted');

  return { ...response, nextDeltaState: response.nextState };
}
