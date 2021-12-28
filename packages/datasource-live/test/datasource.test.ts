import LiveDataSource from '../src/datasource';

import { dataSourceWithDummyCollectionSchema } from './helpers/schemas';

describe('LiveDataSource', () => {
  it('should instanciate properly', () => {
    expect(new LiveDataSource(dataSourceWithDummyCollectionSchema)).toBeDefined();
  });

  describe('collections', () => {
    it('should hold collections according to the given schema', () => {
      const liveDataSource = new LiveDataSource(dataSourceWithDummyCollectionSchema);
      const expectedCollectionCount = Object.entries(
        dataSourceWithDummyCollectionSchema.collections,
      ).length;

      expect(liveDataSource.collections).toBeArrayOfSize(expectedCollectionCount);
    });
  });

  describe('getCollection', () => {
    it('should return null for unknown collection name', () => {
      expect(
        new LiveDataSource(dataSourceWithDummyCollectionSchema).getCollection(
          '__no_such_collection',
        ),
      ).toBeNull();
    });
  });
});
