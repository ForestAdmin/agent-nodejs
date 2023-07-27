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
          ],
        });
      const datasource = await makeReplicaDataSource({
        schema: null,
        pullDumpHandler,
        flattenMode: 'auto',
      });

      const records = await getAllRecords(datasource, 'contacts', ['id', 'name']);

      expect(records).toEqual([
        { id: 1, name: 'f' },
        { id: 2, name: 'orest' },
      ]);
    });
  });
});
