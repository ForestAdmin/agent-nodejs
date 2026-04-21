import createGetMerchantApplicationResultTool from '../../../../src/integrations/kolar/tools/get-merchant-application-result';

const mockResponse = {
  jobStatus: 'COMPLETED',
  result: { decision: 'APPROVED', riskScore: 75, rationale: 'Low risk merchant.' },
};

global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve(mockResponse),
}) as jest.Mock;

describe('createGetMerchantApplicationResultTool', () => {
  const headers = { Authorization: 'Basic abc' };
  const baseUrl = 'https://backend-partners.up.railway.app';

  beforeEach(() => jest.clearAllMocks());

  it('should throw on HTTP error', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ message: 'Application not found' }),
    });

    const tool = createGetMerchantApplicationResultTool(headers, baseUrl);

    await expect(tool.invoke({ id: 999 })).rejects.toThrow(
      'Kolar get merchant application result failed (404): Application not found',
    );
  });

  it('should fetch merchant application result by id', async () => {
    const tool = createGetMerchantApplicationResultTool(headers, baseUrl);

    const result = await tool.invoke({ id: 42 });

    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/merchant-application/42/result`, { headers });
    expect(result).toBe(JSON.stringify(mockResponse));
  });
});
