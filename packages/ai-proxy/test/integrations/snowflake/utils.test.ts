import { AIBadRequestError, McpConnectionError } from '../../../src/errors';
import {
  assertReadOnlySql,
  assertResponseOk,
  assertValidAccountIdentifier,
  buildSessionContext,
  getSnowflakeAuthHeaders,
  getSnowflakeBaseUrl,
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

  describe('getSnowflakeBaseUrl', () => {
    it('should build the URL from the account identifier', () => {
      expect(getSnowflakeBaseUrl('my-account')).toBe('https://my-account.snowflakecomputing.com');
    });

    it.each(['attack.com#', 'attack.com/', 'attack.com:8080', 'attack.com?x=1'])(
      'should reject injection attempt: %s',
      identifier => {
        expect(() => getSnowflakeBaseUrl(identifier)).toThrow(AIBadRequestError);
      },
    );
  });

  describe('assertValidAccountIdentifier', () => {
    it.each([
      'xy12345',
      'XY12345',
      'myorg-myaccount',
      'my_org-my_account',
      'xy12345.us-east-1.aws',
      'xy12345.us-east-1.gcp',
      'xy12345.eu-west-1.azure',
    ])('should accept valid identifier: %s', identifier => {
      expect(() => assertValidAccountIdentifier(identifier)).not.toThrow();
    });

    it.each([
      '',
      'attack.com#',
      'attack.com/',
      'attack.com:8080',
      'attack.com?x=1',
      'attack.com\\foo',
      'attack.com foo',
      'attack.com\nfoo',
      'attack.com@evil.com',
      'a..b',
      '.leading-dot',
      'trailing-dot.',
      'a.b.c.d.e',
    ])('should reject invalid identifier: %j', identifier => {
      expect(() => assertValidAccountIdentifier(identifier)).toThrow(AIBadRequestError);
      expect(() => assertValidAccountIdentifier(identifier)).toThrow(
        /Invalid Snowflake account identifier/,
      );
    });

    it('should reject non-string input', () => {
      expect(() => assertValidAccountIdentifier(undefined as unknown as string)).toThrow(
        AIBadRequestError,
      );
      expect(() => assertValidAccountIdentifier(123 as unknown as string)).toThrow(
        AIBadRequestError,
      );
    });

    it('should reject identifier exceeding the per-segment length cap', () => {
      const tooLong = 'a'.repeat(129);
      expect(() => assertValidAccountIdentifier(tooLong)).toThrow(AIBadRequestError);
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
      "SELECT '--' DELETE FROM users",
      "SELECT '/*' DROP TABLE t",
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
