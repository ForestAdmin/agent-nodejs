import { Aggregation, Filter, Projection } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import { getAllRecords, makeReplicaDataSource, makeSchemaWithId } from './factories';
import { PullDeltaRequest, PullDeltaResponse, ReplicaDataSourceOptions } from '../../src';

describe('cache', () => {
  describe('when reading cache inside a pull delta', () => {
    it('should return the record already created', async () => {
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
            .list({ conditionTree: { field: 'id', operator: 'Present' } }, new Projection('id'));

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

      expect(await getAllRecords(datasource, 'contacts')).toEqual([{ id: 3 }, { id: 4 }]);
      expect(pullDeltaHandler).toHaveBeenCalledTimes(2);
      expect(recordsInCacheInPullDelta).toEqual([{ id: 3 }]);
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
