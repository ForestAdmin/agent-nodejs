import { createSqlDataSource } from '../src';

describe('exports', () => {
  describe.each([['createSqlDataSource', createSqlDataSource]])('class %s', (message, type) => {
    it('should be defined', () => {
      expect(type).toBeDefined();
    });
  });
});
