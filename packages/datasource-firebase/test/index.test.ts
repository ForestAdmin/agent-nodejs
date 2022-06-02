import { FirebaseCollection, FirebaseDataSource, createFirebaseDataSource } from '../src/index';

describe('exports', () => {
  describe('createFirebaseDataSource', () => {
    it('should export a factory function', () => {
      expect(createFirebaseDataSource).toBeInstanceOf(Function);
    });
  });

  describe.each([
    ['FirebaseCollection', FirebaseCollection],
    ['FirebaseDataSource', FirebaseDataSource],
  ])('class %s', (message, type) => {
    it('should be defined', () => {
      expect(type).toBeDefined();
    });
  });
});
