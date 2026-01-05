import type { ReplicaDataSourceOptions } from '../../../src';

import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

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

    it('should trigger the delete handler with pullDeltaOnAfterWrite params', async () => {
      const pullDumpHandler: ReplicaDataSourceOptions['pullDumpHandler'] = jest
        .fn()
        .mockResolvedValueOnce({
          more: false,
          entries: [
            { collection: 'contacts', record: { id: 1 } },
            { collection: 'contacts', record: { id: 2 } },
          ],
        });

      const pullDeltaHandler: ReplicaDataSourceOptions['pullDeltaHandler'] = jest.fn();

      const deleteRecordHandler = jest.fn();
      const datasource = await makeReplicaDataSource({
        deleteRecordHandler,
        pullDumpHandler,
        pullDeltaHandler,
        pullDeltaOnAfterWrite: true,
        schema: makeSchemaWithId('contacts'),
      });

      await datasource
        .getCollection('contacts')
        .delete(factories.caller.build(), factories.filter.idPresent());

      expect(deleteRecordHandler).toHaveBeenCalledTimes(2);
      expect(pullDeltaHandler).toHaveBeenCalledTimes(1);
      expect(deleteRecordHandler).toHaveBeenCalledWith('contacts', { id: 1 });
      expect(deleteRecordHandler).toHaveBeenCalledWith('contacts', { id: 2 });
    });

    it('should delete all ManyToOne or OneToOne associated records', async () => {
      const pullDumpHandler: ReplicaDataSourceOptions['pullDumpHandler'] = jest
        .fn()
        .mockResolvedValueOnce({
          more: false,
          entries: [
            { collection: 'addresses', record: { id: 1, name: 'Paris' } },
            { collection: 'addresses', record: { id: 2, name: 'Clermont-ferrand' } },
            { collection: 'users', record: { id: 1, address: 1 } },
            { collection: 'users', record: { id: 2, address: 2 } },
          ],
        });

      const pullDeltaHandler: ReplicaDataSourceOptions['pullDeltaHandler'] = jest.fn();

      const deleteRecordHandler = jest.fn();
      const datasource = await makeReplicaDataSource({
        deleteRecordHandler,
        pullDumpHandler,
        pullDeltaHandler,
        pullDeltaOnAfterWrite: true,
        schema: [
          {
            name: 'addresses',
            fields: {
              id: { type: 'Integer', isPrimaryKey: true },
              name: { type: 'String' },
            },
          },
          {
            name: 'users',
            fields: {
              id: { type: 'Integer', isPrimaryKey: true },
              address: {
                type: 'Integer',
                unique: true,
                reference: {
                  relationName: 'contactAddress',
                  targetCollection: 'addresses',
                  targetField: 'id',
                },
              },
            },
          },
        ],
      });

      await datasource
        .getCollection('users')
        .delete(factories.caller.build(), factories.filter.idPresent());

      expect(pullDeltaHandler).toHaveBeenCalledTimes(1);
      expect(pullDeltaHandler).toHaveBeenCalledWith(
        expect.objectContaining({ affectedCollections: ['users', 'addresses'] }),
      );
    });

    describe('when the handler is not defined', () => {
      it('should throw an error', async () => {
        const datasource = await makeReplicaDataSource({
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
