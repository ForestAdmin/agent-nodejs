import SqlDataSource from '../src';

describe('exports', () => {
  describe.each([['SqlDataSource', SqlDataSource]])('class %s', (message, type) => {
    it('should be defined', () => {
      expect(type).toBeDefined();
    });
  });
});
