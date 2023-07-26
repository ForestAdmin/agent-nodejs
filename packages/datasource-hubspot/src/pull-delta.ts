import { PullDeltaRequest, PullDeltaResponse } from '@forestadmin/datasource-replica';
import { Logger } from '@forestadmin/datasource-toolkit';
import { Client } from '@hubspot/api-client';

import { retrieveRequestedIds } from './cache';
import {
  checkRecordsAndRelationships,
  pullUpdatedOrNewRecords,
  updateRelationships,
} from './changes';
import { buildManyToManyNames, getRelationsOf } from './relationships';
import { HubSpotOptions, RecordWithRelationships, Response } from './types';

function prepareRecordsToUpdate(
  response: Response,
  collections: string[],
): RecordWithRelationships[] {
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
        relationships: getRelationsOf(collectionName, collections),
      });
    });
  });

  return relations;
}

export default async function pullDelta<TypingsHubspot>(
  client: Client,
  options: HubSpotOptions<TypingsHubspot>,
  request: PullDeltaRequest,
  logger?: Logger,
): Promise<PullDeltaResponse> {
  const availableCollections = Object.keys(options.collections);
  const manyToManyRelations = buildManyToManyNames(availableCollections);
  const response: Response = {
    more: false,
    // save the previous delta state
    nextState: { ...((request.previousDeltaState as object) ?? {}) },
    newOrUpdatedEntries: [],
    deletedEntries: [],
  };

  logger('Debug', 'Pull the updated or new records');
  // when the affectedCollections is empty, we pull all the collections.
  // it is useful when we want to pull all the collections at the startup for example.
  const affectedCollections =
    request.affectedCollections.length === 0 ? availableCollections : request.affectedCollections;
  await pullUpdatedOrNewRecords<TypingsHubspot>(
    client,
    affectedCollections.filter(c => !manyToManyRelations.includes(c)),
    request.previousDeltaState,
    options,
    response,
  );

  logger('Debug', 'update the relations of the updated or new records');
  await Promise.all([
    // depending on the response of the pullUpdatedOrNewRecords call.
    updateRelationships(client, prepareRecordsToUpdate(response, availableCollections), response),
    // check if the requested records on hubspot are deleted or not.
    // if the record is deleted, we need to delete the record and all the relations related to it.
    (async () => {
      logger('Debug', 'Check if the requested records are deleted or not.');
      const reasons = request.reasons.filter(
        reason => !manyToManyRelations.includes(reason?.collection),
      );
      const recordIds = await retrieveRequestedIds(request.cache, reasons);

      // if there is not too many records to update, we can check if the records are deleted or not.
      // it is a performance optimization.
      if (Object.values(recordIds).flat().length < options.pullDeltaMaxRecordUpToDate ?? 500) {
        await checkRecordsAndRelationships(client, recordIds, availableCollections, response);
      } else {
        logger('Warn', 'Too many records to update ');
      }
    })(),
  ]);

  if (response.more === false) {
    logger?.('Info', 'Pull delta is finished. Your replica is up to date.');
  }

  return { ...response, nextDeltaState: response.nextState };
}
