import { createSqlDataSource } from '../src';

describe('createSqlDataSource', () => {
  describe('when the connection Uri is invalid', () => {
    test('should throw an error', () => {
      expect(() => createSqlDataSource('invalid')).toThrowError(
        'Connection Uri "invalid" provided to Sql data source is not valid.' +
          ' Should be <dialect>://<connection>.',
      );
    });
  });

  describe('when the connection Uri is valid', () => {
    test('should return a data source factory', () => {
      const factory = createSqlDataSource('postgres://');

      expect(factory).toBeInstanceOf(Function);
    });
  });
});
