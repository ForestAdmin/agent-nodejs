import createUpdateTicketTool from '../../../../src/integrations/zendesk/tools/update-ticket';

const mockResponse = { ticket: { id: 7, status: 'solved' } };

global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve(mockResponse),
}) as jest.Mock;

describe('createUpdateTicketTool', () => {
  const headers = { Authorization: 'Basic abc', 'Content-Type': 'application/json' };
  const baseUrl = 'https://test.zendesk.com/api/v2';

  beforeEach(() => jest.clearAllMocks());

  it('should throw on HTTP error', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ error: 'RecordNotFound' }),
    });

    const tool = createUpdateTicketTool(headers, baseUrl);

    await expect(tool.invoke({ ticket_id: 999, status: 'solved' })).rejects.toThrow(
      'Zendesk update ticket failed (404): RecordNotFound',
    );
  });

  it('should update a ticket with a single field', async () => {
    const tool = createUpdateTicketTool(headers, baseUrl);

    const result = await tool.invoke({ ticket_id: 7, status: 'solved' });

    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/tickets/7.json`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ ticket: { status: 'solved' } }),
    });
    expect(result).toBe(JSON.stringify(mockResponse));
  });

  it('should update a ticket with multiple fields', async () => {
    const tool = createUpdateTicketTool(headers, baseUrl);

    await tool.invoke({
      ticket_id: 7,
      subject: 'Updated',
      priority: 'urgent',
      type: 'task',
      assignee_id: 3,
      requester_id: 4,
      tags: ['vip'],
      custom_fields: [{ id: 10, value: 'bar' }],
      due_at: '2026-04-01T00:00:00Z',
    });

    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/tickets/7.json`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        ticket: {
          subject: 'Updated',
          priority: 'urgent',
          type: 'task',
          assignee_id: 3,
          requester_id: 4,
          tags: ['vip'],
          custom_fields: [{ id: 10, value: 'bar' }],
          due_at: '2026-04-01T00:00:00Z',
        },
      }),
    });
  });

  it('should send empty ticket object when no optional fields provided', async () => {
    const tool = createUpdateTicketTool(headers, baseUrl);

    await tool.invoke({ ticket_id: 7 });

    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/tickets/7.json`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ ticket: {} }),
    });
  });
});
