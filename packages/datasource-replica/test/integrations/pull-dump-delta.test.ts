import type {
  PullDeltaRequest,
  PullDeltaResponse,
  PullDumpResponse,
  ReplicaDataSourceOptions,
} from '../../src';

import { getAllRecords, makeReplicaDataSource, makeSchemaWithId } from './factories';

describe('pull dump and delta', () => {
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
          deltaDeltaStatesAfterCalls.push(request.previousDeltaState as never);

          return {
            more: false,
            newOrUpdatedEntries: [{ collection: 'contacts', record: { id: 3 } }],
            nextDeltaState: 'delta-state',
            deletedEntries: [],
          } as PullDeltaResponse;
        });

      const datasource = await makeReplicaDataSource({
        pullDumpHandler,
        pullDeltaHandler,
        schema: makeSchemaWithId('contacts'),
        pullDeltaOnRestart: true,
      });

      expect(pullDumpHandler).toHaveBeenCalledTimes(1);
      expect(pullDeltaHandler).toHaveBeenCalledTimes(1);

      expect(await getAllRecords(datasource, 'contacts')).toEqual([
        { id: 1 },
        { id: 2 },
        { id: 3 },
      ]);
      expect(deltaDeltaStatesAfterCalls).toEqual(['dump-state']);
    });
  });
});
