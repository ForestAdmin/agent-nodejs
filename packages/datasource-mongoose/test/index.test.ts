import { MongooseCollection, MongooseDatasource } from '../src';

describe('exports', () => {
  describe.each([
    ['MongooseCollection', MongooseCollection],
    ['MongooseDatasource', MongooseDatasource],
  ])('class %s', (message, type) => {
    it('should be defined', () => {
      expect(type).toBeDefined();
    });
  });
});
