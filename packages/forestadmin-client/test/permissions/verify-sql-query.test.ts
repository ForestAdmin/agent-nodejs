import ChainedSQLQueryError from '../../src/permissions/errors/chained-sql-query-error';
import EmptySQLQueryError from '../../src/permissions/errors/empty-sql-query-error';
import NonSelectSQLQueryError from '../../src/permissions/errors/non-select-sql-query-error';
import verifySQLQuery from '../../src/permissions/verify-sql-query';

describe('verifySQLQuery', () => {
  describe('with an empty sql', () => {
    it('should throw an EmptySQLQueryError error', () => {
      expect(() => verifySQLQuery('    ')).toThrow(EmptySQLQueryError);
    });
  });

  describe('with a chained sql query', () => {
    it('should throw a ChainedSQLQueryError error', () => {
      expect(() => verifySQLQuery('SELECT 10 FROM siths; SELECT 12 FROM jedis;')).toThrow(
        ChainedSQLQueryError,
      );
    });
  });

  describe('with a non select sql query', () => {
    it('should throw a NonSelectSQLQueryError error', () => {
      expect(() => verifySQLQuery("UPDATE siths SET name = 'vador';")).toThrow(
        NonSelectSQLQueryError,
      );
    });
  });

  describe('with a valid select sql query prefixed by spaces', () => {
    it('should return true', () => {
      const result = verifySQLQuery('  SELECT count(*) as value FROM siths   ');
      expect(result).toBe(true);
    });
  });
});
