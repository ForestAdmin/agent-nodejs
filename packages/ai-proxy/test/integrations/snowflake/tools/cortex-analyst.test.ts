import createCortexAnalystTool from '../../../../src/integrations/snowflake/tools/cortex-analyst';

const mockResponse = { message: { content: [{ type: 'text', text: 'answer' }] } };

global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve(mockResponse),
}) as jest.Mock;

describe('createCortexAnalystTool', () => {
  const headers = { Authorization: 'Bearer token' };
  const baseUrl = 'https://my-account.snowflakecomputing.com';

  beforeEach(() => jest.clearAllMocks());

  it('should POST the question with semantic_model_file', async () => {
    const tool = createCortexAnalystTool(headers, baseUrl);

    const result = await tool.invoke({
      question: 'What is the total revenue this year?',
      semantic_model_file: '@db.sc.stage/model.yaml',
    });

    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/api/v2/cortex/analyst/message`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'What is the total revenue this year?' }],
          },
        ],
        semantic_model_file: '@db.sc.stage/model.yaml',
      }),
    });
    expect(result).toBe(JSON.stringify(mockResponse));
  });

  it('should POST the question with semantic_view', async () => {
    const tool = createCortexAnalystTool(headers, baseUrl);

    await tool.invoke({ question: 'q', semantic_view: 'db.sc.view' });

    expect(fetch).toHaveBeenCalledWith(
      `${baseUrl}/api/v2/cortex/analyst/message`,
      expect.objectContaining({
        body: JSON.stringify({
          messages: [{ role: 'user', content: [{ type: 'text', text: 'q' }] }],
          semantic_view: 'db.sc.view',
        }),
      }),
    );
  });

  it('should throw when neither semantic_model_file nor semantic_view is provided', async () => {
    const tool = createCortexAnalystTool(headers, baseUrl);

    await expect(tool.invoke({ question: 'q' })).rejects.toThrow(
      'Either `semantic_model_file` or `semantic_view` must be provided.',
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('should throw when both semantic_model_file and semantic_view are provided', async () => {
    const tool = createCortexAnalystTool(headers, baseUrl);

    await expect(
      tool.invoke({
        question: 'q',
        semantic_model_file: '@s/f.yaml',
        semantic_view: 'db.sc.v',
      }),
    ).rejects.toThrow('Provide only one of `semantic_model_file` or `semantic_view`, not both.');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('should throw on HTTP error', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: async () => ({ message: 'Rate limited' }),
    });

    const tool = createCortexAnalystTool(headers, baseUrl);

    await expect(
      tool.invoke({ question: 'q', semantic_view: 'db.sc.v' }),
    ).rejects.toThrow('Snowflake cortex analyst failed (429): Rate limited');
  });
});
