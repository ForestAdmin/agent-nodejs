import { BaseAction, BaseCollection, SchemaUtils } from '../src';

describe('exports', () => {
  describe.each([
    ['BaseAction', BaseAction],
    ['BaseCollection', BaseCollection],
    ['SchemaUtils', SchemaUtils],
  ])('class %s', (message, type) => {
    it('should be defined', () => {
      expect(type).toBeDefined();
    });
  });
});
