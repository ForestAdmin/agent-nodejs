import { LiveDataSource } from '../src';

describe('exports', () => {
  describe.each([['LiveDataSource', LiveDataSource]])('class %s', (message, type) => {
    it('should be defined', () => {
      expect(type).toBeDefined();
    });
  });
});
