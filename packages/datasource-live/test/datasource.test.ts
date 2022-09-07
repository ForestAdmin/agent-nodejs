import { LiveSchema } from '../src/types';
import LiveDataSource from '../src/datasource';

const dataSourceWithDummyCollectionSchema: LiveSchema = {
  dummy: {},
};

const emptyDataSourceSchema: LiveSchema = {};

describe('LiveDataSource', () => {
  it('should instanciate properly', () => {
    expect(new LiveDataSource(emptyDataSourceSchema)).toBeDefined();
  });

  describe('attributes', () => {
    describe('collections', () => {
      it('should hold collections according to the given schema', () => {
        const liveDataSource = new LiveDataSource(dataSourceWithDummyCollectionSchema);
        const expectedCollectionCount = Object.entries(dataSourceWithDummyCollectionSchema).length;

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
