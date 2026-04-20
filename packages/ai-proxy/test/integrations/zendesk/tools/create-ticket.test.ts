import createCreateTicketTool from '../../../../src/integrations/zendesk/tools/create-ticket';

const mockResponse = { ticket: { id: 99, subject: 'New ticket' } };

global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve(mockResponse),
}) as jest.Mock;

describe('createCreateTicketTool', () => {
  const headers = { Authorization: 'Basic abc', 'Content-Type': 'application/json' };
  const baseUrl = 'https://test.zendesk.com/api/v2';

  beforeEach(() => jest.clearAllMocks());

  it('should throw on HTTP error', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      json: async () => ({ error: 'Validation failed' }),
    });

    const tool = createCreateTicketTool(headers, baseUrl);

    await expect(tool.invoke({ subject: 'Bug', description: 'It broke' })).rejects.toThrow(
      'Zendesk create ticket failed (422): Validation failed',
    );
  });

  it('should create a ticket with required fields', async () => {
    const tool = createCreateTicketTool(headers, baseUrl);

    const result = await tool.invoke({ subject: 'Bug', description: 'It broke' });

    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/tickets.json`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ticket: { subject: 'Bug', comment: { body: 'It broke' } } }),
    });
    expect(result).toBe(JSON.stringify(mockResponse));
  });

  it('should create a ticket with all optional fields', async () => {
    const tool = createCreateTicketTool(headers, baseUrl);

    await tool.invoke({
      subject: 'Bug',
      description: 'Broken',
      requester_id: 1,
      assignee_id: 2,
      priority: 'high',
      type: 'incident',
      tags: ['urgent'],
      custom_fields: [{ id: 100, value: 'foo' }],
      status: 'open',
    });

    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/tickets.json`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ticket: {
          subject: 'Bug',
          comment: { body: 'Broken' },
          requester_id: 1,
          assignee_id: 2,
          priority: 'high',
          type: 'incident',
          tags: ['urgent'],
          custom_fields: [{ id: 100, value: 'foo' }],
          status: 'open',
        },
      }),
    });
  });

  it('should create a ticket with recipient email', async () => {
    const tool = createCreateTicketTool(headers, baseUrl);

    await tool.invoke({
      subject: 'Bug',
      description: 'Broken',
      recipient_email: 'notify@example.com',
    });

    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/tickets.json`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ticket: {
          subject: 'Bug',
          comment: { body: 'Broken' },
          recipient: 'notify@example.com',
        },
      }),
    });
  });

  it('should create a ticket with status', async () => {
    const tool = createCreateTicketTool(headers, baseUrl);

    await tool.invoke({
      subject: 'Bug',
      description: 'Broken',
      status: 'pending',
    });

    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/tickets.json`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ticket: {
          subject: 'Bug',
          comment: { body: 'Broken' },
          status: 'pending',
        },
      }),
    });
  });

  it('should create a ticket with requester email', async () => {
    const tool = createCreateTicketTool(headers, baseUrl);

    await tool.invoke({
      subject: 'Bug',
      description: 'Broken',
      requester_email: 'user@example.com',
    });

    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/tickets.json`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ticket: {
          subject: 'Bug',
          comment: { body: 'Broken' },
          requester: { email: 'user@example.com' },
        },
      }),
    });
  });

  it('should create a ticket with requester email and name', async () => {
    const tool = createCreateTicketTool(headers, baseUrl);

    await tool.invoke({
      subject: 'Bug',
      description: 'Broken',
      requester_email: 'user@example.com',
      requester_name: 'John Doe',
    });

    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/tickets.json`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ticket: {
          subject: 'Bug',
          comment: { body: 'Broken' },
          requester: { email: 'user@example.com', name: 'John Doe' },
        },
      }),
    });
  });

  it('should create a ticket with requester name only', async () => {
    const tool = createCreateTicketTool(headers, baseUrl);

    await tool.invoke({
      subject: 'Bug',
      description: 'Broken',
      requester_name: 'John Doe',
    });

    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/tickets.json`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ticket: {
          subject: 'Bug',
          comment: { body: 'Broken' },
          requester: { name: 'John Doe' },
        },
      }),
    });
  });
});
