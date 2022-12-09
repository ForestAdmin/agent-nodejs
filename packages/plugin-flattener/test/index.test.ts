import { flattenColumn, flattenRelation } from '../src/index';

describe('index', () => {
  test('should export flattenColumn', () => {
    expect(flattenColumn).toBeInstanceOf(Function);
  });

  test('should export flattenRelation', () => {
    expect(flattenRelation).toBeInstanceOf(Function);
  });
});
