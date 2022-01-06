import { SequelizeCollection, SequelizeDataSource } from '../src';

describe('exports', () => {
  describe('class SequelizeCollection', () => {
    it('should be defined', () => {
      expect(SequelizeCollection).toBeDefined();
    });
  });

  describe('class SequelizeDataSource', () => {
    it('should be defined', () => {
      expect(SequelizeDataSource).toBeDefined();
    });
  });
});
