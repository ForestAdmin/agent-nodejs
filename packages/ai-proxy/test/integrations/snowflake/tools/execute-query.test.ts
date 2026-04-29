import type { SnowflakeConfig } from '../../../../src/integrations/snowflake/tools';

import createExecuteQueryTool from '../../../../src/integrations/snowflake/tools/execute-query';

const mockResponse = { resultSetMetaData: {}, data: [[1]] };

global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve(mockResponse),
}) as jest.Mock;

describe('createExecuteQueryTool', () => {
  const headers = { Authorization: 'Bearer token' };
  const baseUrl = 'https://my-account.snowflakecomputing.com';
  const config: SnowflakeConfig = {
    accountIdentifier: 'my-account',
    programmaticAccessToken: 'pat-secret',
    defaultWarehouse: 'WH_DEFAULT',
    defaultDatabase: 'DB_DEFAULT',
  };

  beforeEach(() => jest.clearAllMocks());

  it('should POST the statement with default session context', async () => {
    const tool = createExecuteQueryTool(headers, baseUrl, config);

    const result = await tool.invoke({ statement: 'SELECT 1' });

    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/api/v2/statements`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        statement: 'SELECT 1',
        warehouse: 'WH_DEFAULT',
        database: 'DB_DEFAULT',
      }),
    });
    expect(result).toBe(JSON.stringify(mockResponse));
  });

  it('should let per-call overrides win over defaults', async () => {
    const tool = createExecuteQueryTool(headers, baseUrl, config);

    await tool.invoke({
      statement: 'SELECT 1',
      warehouse: 'WH_OVERRIDE',
      database: 'DB_OVERRIDE',
      schema: 'SC_OVERRIDE',
      role: 'RL_OVERRIDE',
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          statement: 'SELECT 1',
          warehouse: 'WH_OVERRIDE',
          database: 'DB_OVERRIDE',
          schema: 'SC_OVERRIDE',
          role: 'RL_OVERRIDE',
        }),
      }),
    );
  });

  it('should reject non-read-only statements before calling Snowflake', async () => {
    const tool = createExecuteQueryTool(headers, baseUrl, config);

    await expect(tool.invoke({ statement: 'DELETE FROM users' })).rejects.toThrow(
      'Only read-only statements (SELECT, SHOW, DESCRIBE, EXPLAIN) are allowed.',
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('should reject multi-statement payloads', async () => {
    const tool = createExecuteQueryTool(headers, baseUrl, config);

    await expect(tool.invoke({ statement: 'SELECT 1; DROP TABLE t' })).rejects.toThrow(
      'Only a single SQL statement is allowed. Multiple statements are not permitted.',
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('should throw on HTTP error', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ message: 'SQL compilation error' }),
    });

    const tool = createExecuteQueryTool(headers, baseUrl, config);

    await expect(tool.invoke({ statement: 'SELECT bad' })).rejects.toThrow(
      'Snowflake execute query failed (400): SQL compilation error',
    );
  });
});
