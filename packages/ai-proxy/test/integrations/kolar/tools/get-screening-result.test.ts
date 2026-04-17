import createGetScreeningResultTool from '../../../../src/integrations/kolar/tools/get-screening-result';

const mockResponse = {
  jobStatus: 'COMPLETED',
  result: { decision: 'FALSE_POSITIVE', rationale: 'Names do not match.' },
};

global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve(mockResponse),
}) as jest.Mock;

describe('createGetScreeningResultTool', () => {
  const headers = { Authorization: 'Basic abc' };
  const baseUrl = 'https://backend-partners.up.railway.app';

  beforeEach(() => jest.clearAllMocks());

  it('should throw on HTTP error', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ message: 'Alert not found' }),
    });

    const tool = createGetScreeningResultTool(headers, baseUrl);

    await expect(tool.invoke({ id: 999 })).rejects.toThrow(
      'Kolar get screening result failed (404): Alert not found',
    );
  });

  it('should fetch screening result by alert id', async () => {
    const tool = createGetScreeningResultTool(headers, baseUrl);

    const result = await tool.invoke({ id: 42 });

    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/alert/42/result`, { headers });
    expect(result).toBe(JSON.stringify(mockResponse));
  });
});
