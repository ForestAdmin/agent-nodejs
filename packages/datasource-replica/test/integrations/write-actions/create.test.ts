import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import { makeReplicateDataSource, makeSchemaWithId } from '../factories';

describe('create', () => {
  describe('when a create is call', () => {
    it('should trigger the create handler', async () => {
      const createRecordHandler = jest.fn();
      const datasource = await makeReplicateDataSource({
        createRecordHandler,
        schema: makeSchemaWithId('contacts'),
      });

      await datasource
        .getCollection('contacts')
        .create(factories.caller.build(), [{ id: 1 }, { id: 2 }]);

      expect(createRecordHandler).toHaveBeenCalledTimes(2);
      expect(createRecordHandler).toHaveBeenCalledWith('contacts', [{ id: 1 }]);
      expect(createRecordHandler).toHaveBeenCalledWith('contacts', [{ id: 2 }]);
    });
  });
});
