import DummyDataSource from '../src/datasource';

describe('DummyDataSource', () => {
  it('should instanciate properly', () => {
    expect(new DummyDataSource()).toBeDefined();
  });

  describe('collections', () => {
    it('should only hold the book collection', () => {
      const dummyDataSource = new DummyDataSource();

      expect(dummyDataSource.collections).toBeArrayOfSize(1);
      expect(dummyDataSource.collections).toEqual([
        expect.objectContaining({
          name: 'book',
        }),
      ]);
    });
  });

  describe('getCollection', () => {
    it("should give access to the 'book' collection", () => {
      const dummyDataSource = new DummyDataSource();

      expect(dummyDataSource.getCollection('book')).toMatchObject({
        name: 'book',
      });
    });

    it('should return null for unknown collection name', () => {
      expect(new DummyDataSource().getCollection('__no_such_collection')).toBeNull();
    });
  });
});
