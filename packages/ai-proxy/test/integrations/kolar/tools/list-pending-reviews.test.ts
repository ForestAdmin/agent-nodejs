import createListPendingReviewsTool from '../../../../src/integrations/kolar/tools/list-pending-reviews';

const mockResponse = {
  items: [{ id: 1, alertResultId: 42, status: 'PENDING', decision: null }],
};

global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve(mockResponse),
}) as jest.Mock;

describe('createListPendingReviewsTool', () => {
  const headers = { Authorization: 'Basic abc' };
  const baseUrl = 'https://backend-partners.up.railway.app';

  beforeEach(() => jest.clearAllMocks());

  it('should throw on HTTP error', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ error: 'Server error' }),
    });

    const tool = createListPendingReviewsTool(headers, baseUrl);

    await expect(tool.invoke({})).rejects.toThrow(
      'Kolar list pending reviews failed (500): Server error',
    );
  });

  it('should fetch pending reviews', async () => {
    const tool = createListPendingReviewsTool(headers, baseUrl);

    const result = await tool.invoke({});

    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/internal-control?status=PENDING`, { headers });
    expect(result).toBe(JSON.stringify(mockResponse));
  });
});
