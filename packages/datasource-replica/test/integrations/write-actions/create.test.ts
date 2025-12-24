import type { ReplicaDataSourceOptions } from '../../../src';

import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import { makeReplicaDataSource, makeSchemaWithId } from '../factories';

describe('create', () => {
  describe('when a create is called', () => {
    it('should trigger the create handler', async () => {
      const createRecordHandler = jest.fn();
      const datasource = await makeReplicaDataSource({
        createRecordHandler,
        schema: makeSchemaWithId('contacts'),
      });

      await datasource
        .getCollection('contacts')
        .create(factories.caller.build(), [{ id: 1 }, { id: 2 }]);

      expect(createRecordHandler).toHaveBeenCalledTimes(2);
      expect(createRecordHandler).toHaveBeenCalledWith('contacts', { id: 1 });
      expect(createRecordHandler).toHaveBeenCalledWith('contacts', { id: 2 });
    });

    it('should trigger the create handler with pullDeltaOnAfterWrite params', async () => {
      const createRecordHandler = jest.fn();

      const pullDeltaHandler: ReplicaDataSourceOptions['pullDeltaHandler'] = jest.fn();

      const datasource = await makeReplicaDataSource({
        createRecordHandler,
        pullDeltaHandler,
        pullDeltaOnAfterWrite: true,
        schema: makeSchemaWithId('contacts'),
      });

      await datasource
        .getCollection('contacts')
        .create(factories.caller.build(), [{ id: 1 }, { id: 2 }]);

      expect(createRecordHandler).toHaveBeenCalledTimes(2);
      expect(pullDeltaHandler).toHaveBeenCalledTimes(1);
      expect(createRecordHandler).toHaveBeenCalledWith('contacts', { id: 1 });
      expect(createRecordHandler).toHaveBeenCalledWith('contacts', { id: 2 });
    });
  });

  describe('when the handler is not defined', () => {
    it('should throw an error', async () => {
      const datasource = await makeReplicaDataSource({
        schema: makeSchemaWithId('contacts'),
      });

      await expect(() =>
        datasource
          .getCollection('contacts')
          .create(factories.caller.build(), [{ id: 1 }, { id: 2 }]),
      ).rejects.toThrow('This collection does not supports creations');
    });
  });

  describe('when flatten options is given', () => {
    it('should throw an error', async () => {
      await expect(() =>
        makeReplicaDataSource({
          createRecordHandler: jest.fn(),
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
