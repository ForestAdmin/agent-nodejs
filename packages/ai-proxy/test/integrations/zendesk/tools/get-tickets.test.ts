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

  it('should search tickets by requester email', async () => {
    const tool = createGetTicketsTool(headers, baseUrl);

    const result = await tool.invoke({ requester_email: 'user@example.com' });

    const expectedParams = new URLSearchParams({
      query: 'requester:user@example.com type:ticket',
      page: '1',
      per_page: '25',
      sort_by: 'created_at',
      sort_order: 'desc',
    });
    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/search.json?${expectedParams}`, { headers });
    expect(result).toBe(JSON.stringify(mockResponse));
  });

  it('should search tickets by submitter email', async () => {
    const tool = createGetTicketsTool(headers, baseUrl);

    await tool.invoke({ submitter_email: 'submitter@example.com' });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('query=submitter%3Asubmitter%40example.com+type%3Aticket'),
      { headers },
    );
  });

  it('should search tickets by cc email', async () => {
    const tool = createGetTicketsTool(headers, baseUrl);

    await tool.invoke({ cc_email: 'cc@example.com' });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('query=cc%3Acc%40example.com+type%3Aticket'),
      { headers },
    );
  });

  it('should search tickets by assignee email', async () => {
    const tool = createGetTicketsTool(headers, baseUrl);

    await tool.invoke({ assignee_email: 'agent@example.com' });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('query=assignee%3Aagent%40example.com+type%3Aticket'),
      { headers },
    );
  });

  it('should search tickets by status and priority', async () => {
    const tool = createGetTicketsTool(headers, baseUrl);

    await tool.invoke({ status: 'open', priority: 'urgent' });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('query=status%3Aopen+priority%3Aurgent+type%3Aticket'),
      { headers },
    );
  });

  it('should search tickets by date range', async () => {
    const tool = createGetTicketsTool(headers, baseUrl);

    await tool.invoke({ created_after: '2024-01-01', created_before: '2024-06-01' });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('query=created%3E2024-01-01+created%3C2024-06-01+type%3Aticket'),
      { headers },
    );
  });

  it('should search tickets by updated_after', async () => {
    const tool = createGetTicketsTool(headers, baseUrl);

    await tool.invoke({ updated_after: '2024-03-01' });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('query=updated%3E2024-03-01+type%3Aticket'),
      { headers },
    );
  });

  it('should search tickets by solved_after', async () => {
    const tool = createGetTicketsTool(headers, baseUrl);

    await tool.invoke({ solved_after: '2024-05-01' });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('query=solved%3E2024-05-01+type%3Aticket'),
      { headers },
    );
  });

  it('should search tickets by description', async () => {
    const tool = createGetTicketsTool(headers, baseUrl);

    await tool.invoke({ description: 'login error' });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('query=description%3A%22login+error%22+type%3Aticket'),
      { headers },
    );
  });

  it('should search tickets by tags', async () => {
    const tool = createGetTicketsTool(headers, baseUrl);

    await tool.invoke({ tags: ['vip', 'billing'] });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('query=tags%3Avip+tags%3Abilling+type%3Aticket'),
      { headers },
    );
  });

  it('should search tickets by subject and keyword', async () => {
    const tool = createGetTicketsTool(headers, baseUrl);

    await tool.invoke({ subject: 'refund', keyword: 'payment issue' });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('query=subject%3Arefund+%22payment+issue%22+type%3Aticket'),
      { headers },
    );
  });

  it('should combine multiple filters', async () => {
    const tool = createGetTicketsTool(headers, baseUrl);

    await tool.invoke({
      requester_email: 'user@example.com',
      status: 'open',
      priority: 'high',
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        'query=requester%3Auser%40example.com+status%3Aopen+priority%3Ahigh+type%3Aticket',
      ),
      { headers },
    );
  });

  it('should not add type:ticket when ticket_type is specified', async () => {
    const tool = createGetTicketsTool(headers, baseUrl);

    await tool.invoke({ ticket_type: 'incident' });

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('query=type%3Aincident'), {
      headers,
    });
    expect(fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('type%3Aticket'),
      expect.anything(),
    );
  });

  it('should search by group and brand', async () => {
    const tool = createGetTicketsTool(headers, baseUrl);

    await tool.invoke({ group: 'support', brand: 'acme' });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('query=group%3Asupport+brand%3Aacme+type%3Aticket'),
      { headers },
    );
  });

  it('should quote multi-word filter values', async () => {
    const tool = createGetTicketsTool(headers, baseUrl);

    await tool.invoke({ group: 'tier 1 support', subject: 'billing issue', brand: 'acme' });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        'query=group%3A%22tier+1+support%22+brand%3Aacme+subject%3A%22billing+issue%22+type%3Aticket',
      ),
      { headers },
    );
  });

  it('should skip empty tags array', async () => {
    const tool = createGetTicketsTool(headers, baseUrl);

    await tool.invoke({ tags: [], status: 'open' });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('query=status%3Aopen+type%3Aticket'),
      { headers },
    );
  });

  it('should throw on HTTP error when searching', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      json: async () => ({ error: 'Invalid query' }),
    });

    const tool = createGetTicketsTool(headers, baseUrl);

    await expect(tool.invoke({ requester_email: 'user@example.com' })).rejects.toThrow(
      'Zendesk search tickets failed (422): Invalid query',
    );
  });
});
