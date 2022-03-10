import Agent, { Collection } from '../src';

describe('exports', () => {
  describe.each([
    ['Collection', Collection],
    ['Agent', Agent],
  ])('class %s', (message, type) => {
    it('should be defined', () => {
      expect(type).toBeDefined();
    });
  });
});
