import { DataSourceSchema } from '@forestadmin/datasource-toolkit';

import LiveDataSource from '../dist/datasource';

const dataSourceWithDummyCollectionSchema: DataSourceSchema = {
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
