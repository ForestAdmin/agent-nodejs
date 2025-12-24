import type { ReplicaDataSourceOptions } from '../../src';

import { getAllRecords, makeReplicaDataSource, makeSchemaWithId } from './factories';

describe('push delta', () => {
  describe('when the delta is finished', () => {
    it('should insert the records by calling the delta only one time', async () => {
      let apiCall;
      const pushDeltaHandler: ReplicaDataSourceOptions['pushDeltaHandler'] = jest
        .fn()
        .mockImplementationOnce((request, onChange) => {
          apiCall = () => {
            onChange({
              newOrUpdatedEntries: [{ collection: 'contacts', record: { id: 3 } }],
              deletedEntries: [],
              nextDeltaState: 'delta-state',
            });
          };
        });

      const datasource = await makeReplicaDataSource({
        pushDeltaHandler,
        schema: makeSchemaWithId('contacts'),
      });

      apiCall();

      expect(await getAllRecords(datasource, 'contacts')).toEqual([{ id: 3 }]);
      expect(pushDeltaHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the delta is empty', () => {
    it('does an iteration without throwing error', async () => {
      let apiCall;
      const pushDeltaHandler: ReplicaDataSourceOptions['pushDeltaHandler'] = jest
        .fn()
        .mockImplementationOnce((request, onChange) => {
          apiCall = () => {
            onChange({ newOrUpdatedEntries: [], deletedEntries: [] });
          };
        });

      const datasource = await makeReplicaDataSource({
        pushDeltaHandler,
        schema: makeSchemaWithId('contacts'),
      });

      apiCall();

      expect(await getAllRecords(datasource, 'contacts')).toEqual([]);
      expect(pushDeltaHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('calling getDeltaState', () => {
    it('should return the right deltaState', async () => {
      let apiCall;
      const pullDeltaHandler: ReplicaDataSourceOptions['pullDeltaHandler'] = jest
        .fn()
        .mockResolvedValueOnce({
          more: true,
          newOrUpdatedEntries: [{ collection: 'contacts', record: { id: 1, name: 'Simon' } }],
          nextDeltaState: 'delta-state',
          deletedEntries: [],
        });

      const pushDeltaHandler: ReplicaDataSourceOptions['pushDeltaHandler'] = jest
        .fn()
        .mockImplementationOnce(request => {
          apiCall = async () => {
            const deltaState = await request.getPreviousDeltaState();

            return deltaState;
          };
        });

      await makeReplicaDataSource({
        pushDeltaHandler,
        pullDeltaHandler,
        schema: makeSchemaWithId('contacts'),
        pullDeltaOnRestart: true,
      });

      const previousDeltaState = await apiCall();
      expect(previousDeltaState).toBe('delta-state');
    });
  });
});
