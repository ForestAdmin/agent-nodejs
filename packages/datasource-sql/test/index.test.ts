import { createSqlDataSource } from '../src';

describe('createSqlDataSource', () => {
  describe('when the connection Uri is invalid', () => {
    test('should throw an error', async () => {
      const factory = createSqlDataSource('invalid');
      const logger = jest.fn();

      await expect(() => factory(logger)).rejects.toThrowError(
        'Connection Uri "invalid" provided to SQL data source is not valid.' +
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
