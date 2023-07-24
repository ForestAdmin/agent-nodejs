import { PullDeltaRequest, PullDeltaResponse } from '@forestadmin/datasource-replica';
import { Logger } from '@forestadmin/datasource-toolkit';
import { Client } from '@hubspot/api-client';

import { checkRecordsAndRelations, pullUpdatedOrNewRecords, updateRelations } from './changes';
import { buildManyToManyNames, getRelationsOf } from './relations';
import { HubSpotOptions, RecordWithRelationNames, Response } from './types';

function prepareRecordsToUpdate(
  response: Response,
  collections: string[],
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
        relations: getRelationsOf(collectionName, collections),
      });
    });
  });

  return relations;
}

async function retrieveRequestedIds(
  cache: PullDeltaRequest['cache'],
  reasons: PullDeltaRequest['reasons'],
): Promise<{ [collectionName: string]: string[] }> {
  const ids = {};
  await Promise.all(
    reasons.map(async reason => {
      const recordIds = await cache.getCollection(reason.collection).list(reason.filter, ['id']);

      ids[reason.collection] = recordIds.map(r => r.id);
    }),
  );

  return ids;
}

export default async function pullDelta<TypingsHubspot>(
  client: Client,
  options: HubSpotOptions<TypingsHubspot>,
  request: PullDeltaRequest,
  logger?: Logger,
): Promise<PullDeltaResponse> {
  const availableCollections = Object.keys(options.collections);
  const manyToManyRelations = buildManyToManyNames(availableCollections);
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

  await Promise.all([
    // depending on the response of the pullUpdatedOrNewRecords call.
    updateRelations(client, prepareRecordsToUpdate(response, availableCollections), response),
    // check if the requested records on hubspot are deleted or not.
    // if the record is deleted, we need to delete the record and all the relations related to it.
    async () => {
      const reasons = request.reasons.filter(reason => {
        return (
          reason.name !== 'startup' &&
          reason.name !== 'schedule' &&
          !manyToManyRelations.includes(reason?.collection)
        );
      });
      const recordIds = await retrieveRequestedIds(request.cache, reasons);

      // if there is not too many records to update, we can check if the records are deleted or not.
      // it is a performance optimization.
      if (Object.values(recordIds).flat().length < options.pullDeltaMaxRecordUpToDate ?? 500) {
        await checkRecordsAndRelations(client, recordIds, availableCollections, response);
      } else {
        logger('Warn', 'Too many records to update ');
      }
    },
  ]);

  if (response.more === false)
    logger?.('Info', 'Pull delta is finished. Your replica has the last changes.');

  return { ...response, nextDeltaState: response.nextState };
}
