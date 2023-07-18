import { PullDeltaRequest, PullDeltaResponse } from '@forestadmin/datasource-cached';
import { Logger } from '@forestadmin/datasource-toolkit';
import { Client } from '@hubspot/api-client';

import {
  deleteRecordsIfNotExist,
  pullUpdatedOrNewRecords,
  updateRelationRecords,
} from './get-changes';
import { getManyToManyRelationNames } from './relations';
import { HubSpotOptions, Response } from './types';

async function getRelationsToUpdate(
  cache,
  relations,
  reasons,
): Promise<{ [relationName: string]: string[] }> {
  const reasonsOnRelationsToUpdate = reasons.filter(reason =>
    relations.includes(reason.collection),
  );

  const relationsToUpdate = {};
  await Promise.all(
    reasonsOnRelationsToUpdate.map(async reason => {
      const id = `${reason.collection.split('_')[0]}_id`;
      const recordIds = await cache.getCollection(reason.collection).list(reason.filter, [id]);

      relationsToUpdate[reason.collection] = recordIds.map(r => r[id]);
    }),
  );

  return relationsToUpdate;
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
  const relations = getManyToManyRelationNames(request.collections);
  const collections = request.collections.filter(c => !relations.includes(c));
  const response: Response = {
    more: false,
    // save the previous delta state
    nextState: { ...((request.previousDeltaState as object) ?? {}) },
    newOrUpdatedEntries: [],
    deletedEntries: [],
  };

  // first pull the update or new records
  await pullUpdatedOrNewRecords<TypingsHubspot>(
    client,
    collections,
    request.previousDeltaState,
    options,
    response,
  );

  // update the records that the user is tying to read
  if (request.reasons.map(r => r.name).includes('before-list')) {
    const beforeListReasons = request.reasons.filter(reason => reason.name === 'before-list');
    const [relationsToUpdate, recordsToDelete] = await Promise.all([
      // it will return relation if the user is trying to read a many to many
      getRelationsToUpdate(request.cache, relations, beforeListReasons),
      // it will delete the record if the user is trying to read a collection
      // with some outdated records
      getRecordsToDelete(request.cache, collections, beforeListReasons),
    ]);

    await Promise.all([
      updateRelationRecords(client, relationsToUpdate, response),
      deleteRecordsIfNotExist(client, recordsToDelete, response),
    ]);
  }

  if (response.more === false) logger?.('Info', 'All the records are updated');
  if (response.deletedEntries.length > 0) logger?.('Info', 'Some records have been deleted');

  return { ...response, nextDeltaState: response.nextState };
}
