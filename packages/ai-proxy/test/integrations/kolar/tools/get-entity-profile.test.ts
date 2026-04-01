import createGetEntityProfileTool from '../../../../src/integrations/kolar/tools/get-entity-profile';

const mockResponse = {
  items: [
    { id: 1, alertResultId: 42, status: 'COMPLETED', decision: 'COMPLIANT' },
    { id: 2, alertResultId: 42, status: 'PENDING', decision: null },
  ],
};

global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve(mockResponse),
}) as jest.Mock;

describe('createGetEntityProfileTool', () => {
  const headers = { Authorization: 'Basic abc' };
  const baseUrl = 'https://backend-partners.up.railway.app';

  beforeEach(() => jest.clearAllMocks());

  it('should throw on HTTP error', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ message: 'Alert result not found' }),
    });

    const tool = createGetEntityProfileTool(headers, baseUrl);

    await expect(tool.invoke({ alertResultId: 999 })).rejects.toThrow(
      'Kolar get entity profile failed (404): Alert result not found',
    );
  });

  it('should fetch entity profile by alert result id', async () => {
    const tool = createGetEntityProfileTool(headers, baseUrl);

    const result = await tool.invoke({ alertResultId: 42 });

    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/internal-control/42/history`, { headers });
    expect(result).toBe(JSON.stringify(mockResponse));
  });
});
