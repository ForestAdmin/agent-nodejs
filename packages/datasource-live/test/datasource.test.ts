import { DataSourceSchema } from '@forestadmin/datasource-toolkit';

import LiveDataSource from '../src/datasource';

const dataSourceWithDummyCollectionSchema: DataSourceSchema = {
  name: '__dummy_data_source__',
  collections: {
    dummy: {
      actions: {},
      fields: {},
      searchable: true,
      segments: [],
    },
  },
};

const emptyDataSourceSchema: DataSourceSchema = {
  name: '__empty_data_source__',
  collections: {},
};

describe('LiveDataSource', () => {
  it('should instanciate properly', () => {
    expect(new LiveDataSource(emptyDataSourceSchema)).toBeDefined();
  });

  describe('attributes', () => {
    describe('collections', () => {
      it('should hold collections according to the given schema', () => {
        const liveDataSource = new LiveDataSource(dataSourceWithDummyCollectionSchema);
        const expectedCollectionCount = Object.entries(
          dataSourceWithDummyCollectionSchema.collections,
        ).length;

        expect(liveDataSource.collections).toBeArrayOfSize(expectedCollectionCount);
      });
    });
  });

  describe('syncCollections', () => {
    it('should return a truthy Promise', async () => {
      const liveDataSource = new LiveDataSource(dataSourceWithDummyCollectionSchema);

      await expect(liveDataSource.syncCollections()).resolves.toBeTruthy();
    });
  });
});
