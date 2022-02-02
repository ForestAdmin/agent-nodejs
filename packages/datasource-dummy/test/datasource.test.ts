import DummyDataSource from '../dist/datasource';

describe('DummyDataSource', () => {
  it('should instanciate properly', () => {
    expect(new DummyDataSource()).toBeDefined();
  });

  describe('collections', () => {
    it('should only hold the book collection', () => {
      const dummyDataSource = new DummyDataSource();

      expect(dummyDataSource.collections).toBeArrayOfSize(2);
      expect(dummyDataSource.collections).toEqual([
        expect.objectContaining({ name: 'books' }),
        expect.objectContaining({ name: 'persons' }),
      ]);
    });
  });
});
