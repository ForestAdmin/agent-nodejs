import { Agent, CollectionCustomizer, createAgent } from '../src';

describe('exports', () => {
  describe.each([
    ['Agent', Agent],
    ['CollectionCustomizer', CollectionCustomizer],
    ['createAgent', createAgent],
  ])('class %s', (message, type) => {
    it('should be defined', () => {
      expect(type).toBeDefined();
    });
  });
});
