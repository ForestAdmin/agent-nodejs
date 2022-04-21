import { createLiveDataSource } from '../src';

describe('exports', () => {
  describe.each([['createLiveDataSource', createLiveDataSource]])('class %s', (message, type) => {
    it('should be defined', () => {
      expect(type).toBeDefined();
    });
  });
});
