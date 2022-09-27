import { CollectionCustomizer, DataSourceCustomizer } from '../src/index';

describe('exports', () => {
  describe.each([
    ['CollectionCustomizer', CollectionCustomizer],
    ['DataSourceCustomizer', DataSourceCustomizer],
  ])('class %s', (message, type) => {
    it('should be defined', () => {
      expect(type).toBeDefined();
    });
  });
});
