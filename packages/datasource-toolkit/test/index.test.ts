import { BaseCollection, BaseDataSource } from '../src/index';

describe('exports', () => {
  describe.each([
    ['BaseCollection', BaseCollection],
    ['BaseDataSource', BaseDataSource],
  ])('class %s', (message, type) => {
    it('should be defined', () => {
      expect(type).toBeDefined();
    });
  });
});
