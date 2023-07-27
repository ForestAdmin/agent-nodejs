import { ReplicaDataSourceOptions } from '../../../src';
import { getAllRecords, makeReplicaDataSource } from '../factories';

describe('schema', () => {
  describe('when the schema is not given', () => {
    it('should compute the schema from the records', async () => {
      const pullDumpHandler: ReplicaDataSourceOptions['pullDumpHandler'] = jest
        .fn()
        .mockResolvedValueOnce({
          more: false,
          entries: [
            { collection: 'contacts', record: { id: 1, name: 'f' } },
            { collection: 'contacts', record: { id: 2, name: 'orest' } },
            {
              collection: 'contacts',
              record: {
                id: 3,
                objectField: {
                  name: 'orest',
                  subField: [1, 2, 3],
                },
              },
            },
          ],
        });
      const datasource = await makeReplicaDataSource({ schema: null, pullDumpHandler });

      const records = await getAllRecords(datasource, 'contacts', ['id', 'name', 'objectField']);

      expect(records).toEqual([
        { id: 1, name: 'f', objectField: null },
        { id: 2, name: 'orest', objectField: null },
        {
          id: 3,
          name: null,
          objectField: {
            name: 'orest',
            subField: [1, 2, 3],
          },
        },
      ]);
    });
  });
});
