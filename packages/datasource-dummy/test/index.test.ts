import { createDummyDataSource } from '../src/index';

describe('getCollections', () => {
  it('should not crash', () => {
    expect(() => createDummyDataSource()).not.toThrow();
  });
});
