import createUpdateDecisionTool from '../../../../src/integrations/kolar/tools/update-decision';

const mockResponse = { id: 2 };

global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve(mockResponse),
}) as jest.Mock;

describe('createUpdateDecisionTool', () => {
  const headers = { Authorization: 'Basic abc', 'Content-Type': 'application/json' };
  const baseUrl = 'https://backend-partners.up.railway.app';

  beforeEach(() => jest.clearAllMocks());

  it('should throw on HTTP error', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ message: 'Internal control not found' }),
    });

    const tool = createUpdateDecisionTool(headers, baseUrl);

    await expect(
      tool.invoke({
        id: 999,
        decision: 'COMPLIANT',
        rationale: 'Correct',
        reviewedBy: 'john.doe',
      }),
    ).rejects.toThrow('Kolar update decision failed (404): Internal control not found');
  });

  it('should submit review decision', async () => {
    const tool = createUpdateDecisionTool(headers, baseUrl);

    const result = await tool.invoke({
      id: 1,
      decision: 'COMPLIANT',
      rationale: 'The screening result is correct.',
      reviewedBy: 'john.doe',
    });

    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/internal-control/1/review`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        decision: 'COMPLIANT',
        rationale: 'The screening result is correct.',
        reviewedBy: 'john.doe',
      }),
    });
    expect(result).toBe(JSON.stringify(mockResponse));
  });
});
