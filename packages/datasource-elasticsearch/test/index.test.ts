import { ElasticsearchCollection, ElasticsearchDataSource, TypeConverter } from '../src';

describe('exports', () => {
  describe.each([
    ['ElasticsearchCollection', ElasticsearchCollection],
    ['ElasticsearchDataSource', ElasticsearchDataSource],
    ['TypeConverter', TypeConverter],
  ])('class %s', (message, type) => {
    it('should be defined', () => {
      expect(type).toBeDefined();
    });
  });
});
