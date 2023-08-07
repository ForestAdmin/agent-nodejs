import { getAllRecords, makeReplicaDataSource, makeSchemaWithId } from './factories';
import { ReplicaDataSourceOptions } from '../../src';

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
});
