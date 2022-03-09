import makeDummyDataSource from '../src/index';

describe('getCollections', () => {
  it('should not crash', () => {
    expect(() => makeDummyDataSource()).not.toThrow();
  });
});
