import { SequelizeCollection, SequelizeDataSource, TypeConverter } from '../dist';

describe('exports', () => {
  describe.each([
    ['SequelizeCollection', SequelizeCollection],
    ['SequelizeDataSource', SequelizeDataSource],
    ['TypeConverter', TypeConverter],
  ])('class %s', (message, type) => {
    it('should be defined', () => {
      expect(type).toBeDefined();
    });
  });
});
