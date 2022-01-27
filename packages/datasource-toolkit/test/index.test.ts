import { BaseCollection, BaseDataSource, SchemaUtils } from '../dist/index';

describe('exports', () => {
  describe.each([
    ['BaseCollection', BaseCollection],
    ['BaseDataSource', BaseDataSource],
    ['SchemaUtils', SchemaUtils],
  ])('class %s', (message, type) => {
    it('should be defined', () => {
      expect(type).toBeDefined();
    });
  });
});
