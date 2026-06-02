import createCortexSearchTool from '../../../../src/integrations/snowflake/tools/cortex-search';

const mockResponse = { results: [{ id: 1, score: 0.9 }] };

global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve(mockResponse),
}) as jest.Mock;

describe('createCortexSearchTool', () => {
  const headers = { Authorization: 'Bearer token' };
  const baseUrl = 'https://my-account.snowflakecomputing.com';

  beforeEach(() => jest.clearAllMocks());

  it('should POST the query to the fully qualified cortex search service URL', async () => {
    const tool = createCortexSearchTool(headers, baseUrl);

    const result = await tool.invoke({
      database: 'MY_DB',
      schema: 'MY_SCHEMA',
      service: 'MY_SVC',
      query: 'find things',
      columns: ['title', 'body'],
      filter: { status: 'active' },
      limit: 5,
    });

    expect(fetch).toHaveBeenCalledWith(
      `${baseUrl}/api/v2/databases/MY_DB/schemas/MY_SCHEMA/cortex-search-services/MY_SVC:query`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: 'find things',
          columns: ['title', 'body'],
          filter: { status: 'active' },
          limit: 5,
        }),
      },
    );
    expect(result).toBe(JSON.stringify(mockResponse));
  });

  it('should URL-encode identifiers with special characters', async () => {
    const tool = createCortexSearchTool(headers, baseUrl);

    await tool.invoke({
      database: 'my db',
      schema: 'my/schema',
      service: 'svc name',
      query: 'q',
    });

    expect(fetch).toHaveBeenCalledWith(
      `${baseUrl}/api/v2/databases/my%20db/schemas/my%2Fschema/cortex-search-services/svc%20name:query`,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('should omit optional fields when not provided', async () => {
    const tool = createCortexSearchTool(headers, baseUrl);

    await tool.invoke({
      database: 'DB',
      schema: 'SC',
      service: 'SVC',
      query: 'q',
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: JSON.stringify({ query: 'q' }) }),
    );
  });

  it('should throw on HTTP error', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: async () => ({ message: 'Insufficient privileges' }),
    });

    const tool = createCortexSearchTool(headers, baseUrl);

    await expect(
      tool.invoke({ database: 'D', schema: 'S', service: 'V', query: 'q' }),
    ).rejects.toThrow('Snowflake cortex search failed (403): Insufficient privileges');
  });
});
