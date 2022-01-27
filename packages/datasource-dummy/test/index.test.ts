import getCollections from '../dist/index';
import DummyDataSource from '../dist/datasource';

describe('getCollections', () => {
  it('should return DummyDataSource collections', () => {
    const dummyDataSource = new DummyDataSource();

    expect(getCollections()).toEqual(dummyDataSource.collections);
  });
});
