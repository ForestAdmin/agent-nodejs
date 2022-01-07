import { BaseCollection, SchemaUtils } from '../src';

describe('exports', () => {
  describe.each([
    ['BaseCollection', BaseCollection],
    ['SchemaUtils', SchemaUtils],
  ])('class %s', (message, type) => {
    it('should be defined', () => {
      expect(type).toBeDefined();
    });
  });
});
