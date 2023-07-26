import { ConditionTreeLeaf, Filter, Projection } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import {
  PullDeltaRequest,
  PullDeltaResponse,
  PullDumpResponse,
  ReplicaDataSourceOptions,
  createReplicaDataSource,
} from '../../src';

describe('pull dump and delta', () => {
  const makeLogger = () => jest.fn();

  const getAllRecords = async (datasource: any) => {
    const allRecordsFilter = new Filter({
      conditionTree: new ConditionTreeLeaf('id', 'Present'),
    });

    return datasource
      .getCollection('contacts')
      .list(factories.caller.build(), allRecordsFilter, new Projection('id'));
  };

  const makeReplicateDataSource = async (options: ReplicaDataSourceOptions) => {
    const replicaFactory = createReplicaDataSource(options);

    return replicaFactory(makeLogger());
  };

  describe('when the dump has been executed and a delta is triggered', () => {
    it('should forward the dump state to the delta state', async () => {
      const deltaDeltaStatesAfterCalls = [];
      const pullDumpHandler: ReplicaDataSourceOptions['pullDumpHandler'] = jest
        .fn()
        .mockResolvedValueOnce({
          more: false,
          entries: [
            { collection: 'contacts', record: { id: 1 } },
            { collection: 'contacts', record: { id: 2 } },
          ],
          nextDeltaState: 'dump-state',
        } as PullDumpResponse);

      const pullDeltaHandler: ReplicaDataSourceOptions['pullDeltaHandler'] = jest
        .fn()
        .mockImplementationOnce(async (request: PullDeltaRequest) => {
          deltaDeltaStatesAfterCalls.push(request.previousDeltaState);

          return {
            more: false,
            newOrUpdatedEntries: [{ collection: 'contacts', record: { id: 3 } }],
            nextDeltaState: 'delta-state',
            deletedEntries: [],
          } as PullDeltaResponse;
        });

      const schema: ReplicaDataSourceOptions['schema'] = [
        { name: 'contacts', fields: { id: { type: 'Number', isPrimaryKey: true } } },
      ];

      const datasource = await makeReplicateDataSource({
        pullDumpHandler,
        pullDeltaHandler,
        schema,
        pullDeltaOnBeforeAccess: true,
      });

      expect(await getAllRecords(datasource)).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
      expect(pullDumpHandler).toHaveBeenCalledTimes(1);
      expect(pullDeltaHandler).toHaveBeenCalledTimes(1);
      expect(deltaDeltaStatesAfterCalls).toEqual(['dump-state']);
    });
  });
});
