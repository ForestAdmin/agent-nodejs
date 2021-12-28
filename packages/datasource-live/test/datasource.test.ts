import LiveDataSource from '../src/datasource';

import { dataSourceWithDummyCollectionSchema } from './helpers/schemas';

describe('LiveDataSource', () => {
  it('should instanciate properly', () => {
    expect(new LiveDataSource(dataSourceWithDummyCollectionSchema)).toBeDefined();
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

  describe('getCollection', () => {
    it('should return null for unknown collection name', () => {
      const liveDataSource = new LiveDataSource(dataSourceWithDummyCollectionSchema);

      expect(liveDataSource.getCollection('__no_such_collection')).toBeNull();
    });
  });

  describe('syncCollections', () => {
    it('should return a truthy Promise', async () => {
      const liveDataSource = new LiveDataSource(dataSourceWithDummyCollectionSchema);

      await expect(liveDataSource.syncCollections()).resolves.toBeTruthy();
    });
  });
});
