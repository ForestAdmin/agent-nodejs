import DummyDataSource from '../src/datasource';

describe('DummyDataSource', () => {
  it('should instanciate properly', () => {
    expect(new DummyDataSource()).toBeDefined();
  });

  describe('attributes', () => {
    describe('collections', () => {
      it('should only hold the book collection', () => {
        const dummyDataSource = new DummyDataSource();

        expect(dummyDataSource.collections).toBeArrayOfSize(1);
        expect(dummyDataSource.collections).toEqual([
          expect.objectContaining({
            name: 'books',
          }),
        ]);
      });
    });
  });
});
