import { PullDeltaRequest, PullDeltaResponse } from '@forestadmin/datasource-replica';
import { Logger } from '@forestadmin/datasource-toolkit';
import { Client } from '@hubspot/api-client';

import {
  deleteRecordsAndItsRelationIfDeleted,
  pullUpdatedOrNewRecords,
  pullUpdatedOrNewRelations,
} from './changes';
import { buildManyToManyNames, getRelationsOf } from './relations';
import { HubSpotOptions, Response } from './types';

function getRelationsToUpdate(
  response: Response,
  availableCollections: string[],
): { id: string; relations: []; collectionName: string }[] {
  const idsByCollection: { [collectionName: string]: string[] } = {};
  response.newOrUpdatedEntries.forEach(r => {
    if (!idsByCollection[r.collection]) idsByCollection[r.collection] = [];
    idsByCollection[r.collection].push(r.record.id);
  });

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
  const manyToManyRelations = buildManyToManyNames(Object.keys(options.collections));
  const collections = request.collections.filter(c => !manyToManyRelations.includes(c));
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

  // depending on the response of the pullUpdatedOrNewRecords call.
  // We should pull the changes to re-compute the relations.
  const relationsToUpdate = getRelationsToUpdate(response, Object.keys(options.collections));
  await pullUpdatedOrNewRelations(client, relationsToUpdate, response);

  if (request.reasons.map(r => r.name).includes('before-list')) {
    const beforeListReasons = request.reasons.filter(reason => reason.name === 'before-list');
    // Avoid to read deleted record.
    // it does nothing for the many to many relations.
    // It is useful when a record is deleted from hubspot because we can't detect it.
    await deleteRecordsAndItsRelationIfDeleted(
      client,
      await getRecordsToDelete(request.cache, collections, beforeListReasons),
      Object.keys(options.collections),
      response,
    );
  }

  if (response.more === false) logger?.('Info', 'Cache is up to date');

  return { ...response, nextDeltaState: response.nextState };
}
