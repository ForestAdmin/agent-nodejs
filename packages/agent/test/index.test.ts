import { Agent, Collection, createAgent } from '../src';

describe('exports', () => {
  describe.each([
    ['Agent', Agent],
    ['Collection', Collection],
    ['createAgent', createAgent],
  ])('class %s', (message, type) => {
    it('should be defined', () => {
      expect(type).toBeDefined();
    });
  });
});
