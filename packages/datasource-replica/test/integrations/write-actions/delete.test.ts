import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import { ReplicaDataSourceOptions } from '../../../src';
import { makeReplicaDataSource, makeSchemaWithId } from '../factories';

describe('delete', () => {
  describe('when a delete is called', () => {
    it('should trigger the delete handler', async () => {
      const pullDumpHandler: ReplicaDataSourceOptions['pullDumpHandler'] = jest
        .fn()
        .mockResolvedValueOnce({
          more: false,
          entries: [
            { collection: 'contacts', record: { id: 1 } },
            { collection: 'contacts', record: { id: 2 } },
          ],
        });

      const deleteRecordHandler = jest.fn();
      const datasource = await makeReplicaDataSource({
        deleteRecordHandler,
        pullDumpHandler,
        schema: makeSchemaWithId('contacts'),
      });

      await datasource
        .getCollection('contacts')
        .delete(factories.caller.build(), factories.filter.idPresent());

      expect(deleteRecordHandler).toHaveBeenCalledTimes(2);
      expect(deleteRecordHandler).toHaveBeenCalledWith('contacts', { id: 1 });
      expect(deleteRecordHandler).toHaveBeenCalledWith('contacts', { id: 2 });
    });

    describe('when the handler is not defined', () => {
      it('should throw an error', async () => {
        const datasource = await makeReplicaDataSource({
          deleteRecordHandler: null,
          schema: makeSchemaWithId('contacts'),
        });

        await expect(() =>
          datasource
            .getCollection('contacts')
            .delete(factories.caller.build(), factories.filter.idPresent()),
        ).rejects.toThrow('This collection does not supports deletes');
      });
    });
  });

  describe('when flatten options is given', () => {
    it('should throw an error', async () => {
      await expect(() =>
        makeReplicaDataSource({
          deleteRecordHandler: jest.fn(),
          schema: [
            {
              name: 'contacts',
              fields: {
                id: { type: 'Number', isPrimaryKey: true },
                bills: {
                  fields: { id: { type: 'Number', isPrimaryKey: true } },
                },
              },
            },
          ],
          flattenOptions: { contacts: { asModels: ['bills'] } },
        }),
      ).rejects.toThrow(
        'Cannot use flattenOptions with createRecordHandler,' +
          ' updateRecordHandler or deleteRecordHandler.',
      );
    });
  });
});
