import type { ReplicaDataSourceOptions } from '../../../src';

import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import { makeReplicaDataSource, makeSchemaWithId } from '../factories';

describe('update', () => {
  describe('when an update is called', () => {
    it('should trigger the update handler', async () => {
      const pullDumpHandler: ReplicaDataSourceOptions['pullDumpHandler'] = jest
        .fn()
        .mockResolvedValueOnce({
          more: false,
          entries: [
            { collection: 'contacts', record: { id: 1 } },
            { collection: 'contacts', record: { id: 2 } },
          ],
        });

      const updateRecordHandler = jest.fn();
      const datasource = await makeReplicaDataSource({
        updateRecordHandler,
        pullDumpHandler,
        schema: makeSchemaWithId('contacts'),
      });

      await datasource
        .getCollection('contacts')
        .update(factories.caller.build(), factories.filter.idPresent(), {
          name: 'updated',
        });

      expect(updateRecordHandler).toHaveBeenCalledTimes(2);
      expect(updateRecordHandler).toHaveBeenCalledWith('contacts', { id: 1, name: 'updated' });
      expect(updateRecordHandler).toHaveBeenCalledWith('contacts', { id: 2, name: 'updated' });
    });

    it('should trigger the update handler with pullDeltaOnAfterWrite params', async () => {
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

      const updateRecordHandler = jest.fn();
      const datasource = await makeReplicaDataSource({
        updateRecordHandler,
        pullDumpHandler,
        pullDeltaHandler,
        pullDeltaOnAfterWrite: true,
        schema: makeSchemaWithId('contacts'),
      });

      await datasource
        .getCollection('contacts')
        .update(factories.caller.build(), factories.filter.idPresent(), {
          name: 'updated',
        });

      expect(updateRecordHandler).toHaveBeenCalledTimes(2);
      expect(pullDeltaHandler).toHaveBeenCalledTimes(1);
      expect(updateRecordHandler).toHaveBeenCalledWith('contacts', { id: 1, name: 'updated' });
      expect(updateRecordHandler).toHaveBeenCalledWith('contacts', { id: 2, name: 'updated' });
    });

    describe('when the handler is not defined', () => {
      it('should throw an error', async () => {
        const datasource = await makeReplicaDataSource({
          schema: makeSchemaWithId('contacts'),
        });

        await expect(() =>
          datasource
            .getCollection('contacts')
            .update(factories.caller.build(), factories.filter.idPresent(), {
              name: 'updated',
            }),
        ).rejects.toThrow('This collection does not supports updates');
      });
    });
  });

  describe('when flatten options is given', () => {
    it('should throw an error', async () => {
      await expect(() =>
        makeReplicaDataSource({
          updateRecordHandler: jest.fn(),
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
