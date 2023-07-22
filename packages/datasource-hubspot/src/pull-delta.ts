import { PullDeltaRequest, PullDeltaResponse } from '@forestadmin/datasource-replica';
import { Logger } from '@forestadmin/datasource-toolkit';
import { Client } from '@hubspot/api-client';

import {
  deleteRecordsAndItsRelationIfDeleted,
  pullUpdatedOrNewRecords,
  updateRelations,
} from './changes';
import { buildManyToManyNames, getRelationsOf } from './relations';
import { HubSpotOptions, RecordWithRelationNames, Response } from './types';

function prepareRecordsToUpdate(
  response: Response,
  availableCollections: string[],
): RecordWithRelationNames[] {
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
  const relationsToUpdate = prepareRecordsToUpdate(response, Object.keys(options.collections));
  await updateRelations(client, relationsToUpdate, response);

  const recordIds = await getRecordsToDelete(request.cache, collections, request.reasons);

  // guard condition on the ids length to keep good performances
  if (Object.values(recordIds).flat().length < options.pullDeltaMaxRecordUpToDate ?? 50) {
    // Avoid to read deleted record.
    // It is useful when a record is deleted from hubspot because we can't detect it.
    await deleteRecordsAndItsRelationIfDeleted(
      client,
      recordIds,
      Object.keys(options.collections),
      response,
    );
  } else {
    logger('Warn', 'Too many records to update ');
  }

  if (response.more === false)
    logger?.('Info', 'Pull delta is finished. Your replica has the last changes.');

  return { ...response, nextDeltaState: response.nextState };
}
