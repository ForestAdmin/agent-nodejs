import type { PullDeltaRequest, PullDeltaResponse, ReplicaDataSourceOptions } from '../../src';

import { Aggregation, Filter } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import { getAllRecords, makeReplicaDataSource, makeSchemaWithId } from './factories';

describe('cache', () => {
  describe('when reading cache inside a pull delta', () => {
    it('should return the record already in the cache', async () => {
      let recordsAlreadyInCache;
      const pullDeltaHandler: ReplicaDataSourceOptions['pullDeltaHandler'] = jest
        .fn()
        .mockImplementationOnce(async () => {
          return {
            more: false,
            newOrUpdatedEntries: [{ collection: 'contacts', record: { id: 3 } }],
            nextDeltaState: 'delta-state',
            deletedEntries: [],
          } as PullDeltaResponse;
        })
        .mockImplementationOnce(async request => {
          recordsAlreadyInCache = await request.cache.getCollection('contacts').list({}, ['id']);

          return {
            more: false,
            newOrUpdatedEntries: [{ collection: 'contacts', record: { id: 4 } }],
            nextDeltaState: 'delta-state',
            deletedEntries: [],
          } as PullDeltaResponse;
        });

      const datasource = await makeReplicaDataSource({
        pullDeltaHandler,
        schema: makeSchemaWithId('contacts'),
        pullDeltaOnBeforeAccess: true,
      });

      // Force pull delta twice
      await getAllRecords(datasource, 'contacts');
      await getAllRecords(datasource, 'contacts');

      expect(pullDeltaHandler).toHaveBeenCalledTimes(2);
      expect(recordsAlreadyInCache).toEqual([{ id: 3 }]);
    });
  });

  describe('when aggregate cache inside a pull delta', () => {
    it('should return the aggregation on the data already created', async () => {
      let recordsInCacheInPullDelta;
      const pullDeltaHandler: ReplicaDataSourceOptions['pullDeltaHandler'] = jest
        .fn()
        .mockImplementationOnce(async () => {
          return {
            more: true,
            newOrUpdatedEntries: [{ collection: 'contacts', record: { id: 3 } }],
            nextDeltaState: 'delta-state',
            deletedEntries: [],
          } as PullDeltaResponse;
        })
        .mockImplementationOnce(async (request: PullDeltaRequest) => {
          recordsInCacheInPullDelta = await request.cache
            .getCollection('contacts')
            .aggregate(
              { conditionTree: { field: 'id', operator: 'Present' } },
              { field: 'id', operation: 'Count' },
            );

          return {
            more: false,
            newOrUpdatedEntries: [{ collection: 'contacts', record: { id: 4 } }],
            nextDeltaState: 'delta-state',
            deletedEntries: [],
          } as PullDeltaResponse;
        });

      const datasource = await makeReplicaDataSource({
        pullDeltaHandler,
        schema: makeSchemaWithId('contacts'),
        pullDeltaOnBeforeAccess: true,
      });

      expect(
        await datasource
          .getCollection('contacts')
          .aggregate(
            factories.caller.build(),
            new Filter({}),
            new Aggregation({ operation: 'Count' }),
          ),
      ).toEqual([{ group: {}, value: 2 }]);

      expect(pullDeltaHandler).toHaveBeenCalledTimes(2);
      expect(recordsInCacheInPullDelta).toEqual([{ group: {}, value: 1 }]);
    });
  });
});
