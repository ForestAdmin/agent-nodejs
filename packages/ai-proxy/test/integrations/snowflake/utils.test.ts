import { AIBadRequestError, McpConnectionError } from '../../../src/errors';
import {
  assertReadOnlySql,
  assertResponseOk,
  buildSessionContext,
  getSnowflakeAuthHeaders,
  getSnowflakeValidationBaseUrl,
  validateSnowflakeConfig,
} from '../../../src/integrations/snowflake/utils';

describe('snowflake/utils', () => {
  const baseConfig = {
    accountIdentifier: 'my-account',
    programmaticAccessToken: 'pat-secret',
  };

  describe('getSnowflakeAuthHeaders', () => {
    it('should return PAT bearer headers', () => {
      expect(getSnowflakeAuthHeaders(baseConfig)).toEqual({
        Authorization: 'Bearer pat-secret',
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Snowflake-Authorization-Token-Type': 'PROGRAMMATIC_ACCESS_TOKEN',
      });
    });
  });

  describe('getSnowflakeValidationBaseUrl', () => {
    it('should build the validation URL from the account identifier only', () => {
      expect(getSnowflakeValidationBaseUrl('my-account')).toBe(
        'https://my-account.snowflakecomputing.com',
      );
    });
  });

  describe('buildSessionContext', () => {
    it('should return empty object when no defaults are set', () => {
      expect(buildSessionContext(baseConfig)).toEqual({});
    });

    it('should include only the provided defaults', () => {
      const result = buildSessionContext({
        ...baseConfig,
        defaultWarehouse: 'WH',
        defaultDatabase: 'DB',
        defaultSchema: 'SC',
        defaultRole: 'RL',
      });

      expect(result).toEqual({ warehouse: 'WH', database: 'DB', schema: 'SC', role: 'RL' });
    });
  });

  describe('assertReadOnlySql', () => {
    it.each([
      'SELECT * FROM users',
      '  select 1',
      'SHOW TABLES',
      'DESCRIBE TABLE users',
      'DESC users',
      'EXPLAIN SELECT 1',
      'SELECT 1;',
    ])('should accept read-only statement: %s', statement => {
      expect(() => assertReadOnlySql(statement)).not.toThrow();
    });

    it('should strip line and block comments before evaluating', () => {
      expect(() => assertReadOnlySql('-- a comment\n/* block */ SELECT 1')).not.toThrow();
    });

    it('should accept semicolons inside string literals (no false positive)', () => {
      expect(() => assertReadOnlySql("SELECT 'a;b' FROM t")).not.toThrow();
    });

    it('should accept disallowed keywords inside string literals', () => {
      expect(() => assertReadOnlySql("SELECT * FROM t WHERE name = 'DROP TABLE x'")).not.toThrow();
    });

    it('should accept disallowed keywords inside double-quoted identifiers', () => {
      expect(() => assertReadOnlySql('SELECT * FROM "DROP"')).not.toThrow();
    });

    it('should reject empty statements', () => {
      expect(() => assertReadOnlySql('   ')).toThrow(AIBadRequestError);
      expect(() => assertReadOnlySql('   ')).toThrow('SQL statement is empty');
    });

    it.each([
      'INSERT INTO t VALUES (1)',
      'UPDATE t SET a=1',
      'DELETE FROM t',
      'DROP TABLE t',
      'CALL proc()',
      'GRANT SELECT ON t TO r',
      'WITH cte AS (SELECT 1) SELECT * FROM cte',
      'WITH cte AS (SELECT 1) DELETE FROM t WHERE id IN (SELECT id FROM cte)',
    ])('should reject statement that does not start with a read-only keyword: %s', statement => {
      expect(() => assertReadOnlySql(statement)).toThrow(AIBadRequestError);
      expect(() => assertReadOnlySql(statement)).toThrow(
        'Only read-only statements (SELECT, SHOW, DESCRIBE, EXPLAIN) are allowed.',
      );
    });

    it.each([
      'EXPLAIN INSERT INTO t VALUES (1)',
      'SELECT 1 -- ;\nDROP TABLE t',
      'SELECT 1 /* */ DROP TABLE t',
    ])('should reject hidden write keyword in: %s', statement => {
      expect(() => assertReadOnlySql(statement)).toThrow(AIBadRequestError);
      expect(() => assertReadOnlySql(statement)).toThrow(
        /SQL statement contains a disallowed keyword/,
      );
    });

    it('should mention the offending keyword in the error message', () => {
      expect(() => assertReadOnlySql('EXPLAIN INSERT INTO t VALUES (1)')).toThrow(
        'SQL statement contains a disallowed keyword: INSERT',
      );
    });

    it('should reject multiple statements separated by ;', () => {
      expect(() => assertReadOnlySql('SELECT 1; SELECT 2')).toThrow(AIBadRequestError);
      expect(() => assertReadOnlySql('SELECT 1; SELECT 2')).toThrow(
        'Only a single SQL statement is allowed. Multiple statements are not permitted.',
      );
    });
  });

  describe('assertResponseOk', () => {
    it('should not throw when response is ok', async () => {
      const response = { ok: true } as Response;
      await expect(assertResponseOk(response, 'test')).resolves.toBeUndefined();
    });

    it('should throw with message field from JSON body', async () => {
      const response = {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ message: 'Invalid identifier' }),
      } as unknown as Response;

      await expect(assertResponseOk(response, 'execute query')).rejects.toThrow(
        'Snowflake execute query failed (400): Invalid identifier',
      );
    });

    it('should fall back to statusText when JSON parsing fails', async () => {
      const response = {
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        json: async () => {
          throw new Error('not json');
        },
      } as unknown as Response;

      await expect(assertResponseOk(response, 'cortex search')).rejects.toThrow(
        'Snowflake cortex search failed (502): Bad Gateway',
      );
    });
  });

  describe('validateSnowflakeConfig', () => {
    beforeEach(() => jest.restoreAllMocks());

    it('should POST SELECT 1 to the account-identifier-only URL with default session context', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ resultSetMetaData: {} }),
      } as Response);

      await expect(
        validateSnowflakeConfig({ ...baseConfig, defaultWarehouse: 'WH' }),
      ).resolves.toBeUndefined();

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://my-account.snowflakecomputing.com/api/v2/statements',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer pat-secret',
            'X-Snowflake-Authorization-Token-Type': 'PROGRAMMATIC_ACCESS_TOKEN',
          }),
          body: JSON.stringify({ statement: 'SELECT 1', warehouse: 'WH' }),
        }),
      );
    });

    it('should throw McpConnectionError including status, URL and server message on failure', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ message: 'Invalid token' }),
      } as unknown as Response);

      await expect(validateSnowflakeConfig(baseConfig)).rejects.toThrow(McpConnectionError);
      await expect(validateSnowflakeConfig(baseConfig)).rejects.toThrow(
        'Failed to validate Snowflake config (HTTP 401 on ' +
          'https://my-account.snowflakecomputing.com/api/v2/statements): Invalid token',
      );
    });

    it('should fall back to statusText when response body is not JSON', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        json: async () => {
          throw new Error('not json');
        },
      } as unknown as Response);

      await expect(validateSnowflakeConfig(baseConfig)).rejects.toThrow(
        'Failed to validate Snowflake config (HTTP 502 on ' +
          'https://my-account.snowflakecomputing.com/api/v2/statements): Bad Gateway',
      );
    });
  });
});
