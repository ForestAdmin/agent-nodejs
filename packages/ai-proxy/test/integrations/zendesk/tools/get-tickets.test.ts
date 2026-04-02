import createGetTicketsTool from '../../../../src/integrations/zendesk/tools/get-tickets';

const mockResponse = { tickets: [{ id: 1 }, { id: 2 }] };

global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve(mockResponse),
}) as jest.Mock;

describe('createGetTicketsTool', () => {
  const headers = { Authorization: 'Basic abc' };
  const baseUrl = 'https://test.zendesk.com/api/v2';

  beforeEach(() => jest.clearAllMocks());

  it('should throw on HTTP error', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ error: 'Invalid credentials' }),
    });

    const tool = createGetTicketsTool(headers, baseUrl);

    await expect(tool.invoke({})).rejects.toThrow(
      'Zendesk get tickets failed (401): Invalid credentials',
    );
  });

  it('should fetch tickets with default params', async () => {
    const tool = createGetTicketsTool(headers, baseUrl);

    const result = await tool.invoke({});

    const expectedParams = new URLSearchParams({
      page: '1',
      per_page: '25',
      sort_by: 'created_at',
      sort_order: 'desc',
    });
    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/tickets.json?${expectedParams}`, { headers });
    expect(result).toBe(JSON.stringify(mockResponse));
  });

  it('should fetch tickets with custom params', async () => {
    const tool = createGetTicketsTool(headers, baseUrl);

    await tool.invoke({ page: 3, per_page: 10, sort_by: 'updated_at', sort_order: 'asc' });

    const expectedParams = new URLSearchParams({
      page: '3',
      per_page: '10',
      sort_by: 'updated_at',
      sort_order: 'asc',
    });
    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/tickets.json?${expectedParams}`, { headers });
  });
});
