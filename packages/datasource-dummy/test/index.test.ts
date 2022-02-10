import DummyDataSource from '../src/datasource';
import getCollections from '../src/index';

describe('getCollections', () => {
  it('should return DummyDataSource collections', () => {
    const dummyDataSource = new DummyDataSource();

    expect(getCollections()).toEqual(dummyDataSource.collections);
  });
});
