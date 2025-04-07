import { MissingFieldError } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import { DataSourceCustomizer } from '../../src';
import importField from '../../src/plugins/import-field';

describe('importField', () => {
  function setupMocks() {
    const dataSource = factories.dataSource.buildWithCollections([
      {
        name: 'collection1',
        schema: {
          fields: {
            field1: { type: 'Column', columnType: 'String' },
          },
          actions: {},
          charts: [],
          countable: true,
          searchable: true,
          segments: [],
        },
      },
      {
        name: 'collection2',
        schema: {
          fields: {
            field2: { type: 'Column', columnType: 'String' },
          },
          actions: {},
          charts: [],
          countable: true,
          searchable: true,
          segments: [],
        },
      },
    ]);

    return { dataSource };
  }

  it('should throw a MissingFieldError when the field does not exist', async () => {
    const { dataSource } = setupMocks();
    const dataSourceCustomizer = new DataSourceCustomizer({
      ignoreMissingSchemaElementErrors: false,
      restartAgentFunction: async () => {},
    });
    dataSourceCustomizer.addDataSource(async () => dataSource);

    // Needed to apply customizations
    await dataSourceCustomizer.getDataSource(jest.fn());

    await expect(
      importField(dataSourceCustomizer, dataSourceCustomizer.getCollection('collection1'), {
        path: 'INVALID',
        name: 'NOPE',
      }),
    ).rejects.toThrow(MissingFieldError);
  });
});
