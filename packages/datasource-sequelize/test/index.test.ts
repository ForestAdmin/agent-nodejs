import { SequelizeCollection, SequelizeDataSource } from '../src';

describe('exports', () => {
  describe('class SequelizeCollection', () => {
    it('should be define', () => {
      expect(SequelizeCollection).toBeDefined();
    });
  });

  describe('class SequelizeDataSource', () => {
    it('should be define', () => {
      expect(SequelizeDataSource).toBeDefined();
    });
  });
});
