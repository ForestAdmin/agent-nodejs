import { Collection, createAgent } from '../src';

describe('exports', () => {
  describe.each([
    ['Collection', Collection],
    ['createAgent', createAgent],
  ])('class %s', (message, type) => {
    it('should be defined', () => {
      expect(type).toBeDefined();
    });
  });
});
