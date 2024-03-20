import { flattenColumn, flattenJsonColumn, flattenRelation } from '../src/index';

describe('index', () => {
  test('should export flattenColumn', () => {
    expect(flattenColumn).toBeInstanceOf(Function);
  });

  test('should export flattenRelation', () => {
    expect(flattenRelation).toBeInstanceOf(Function);
  });

  test('should export flattenJsonColumn', () => {
    expect(flattenJsonColumn).toBeInstanceOf(Function);
  });
});
