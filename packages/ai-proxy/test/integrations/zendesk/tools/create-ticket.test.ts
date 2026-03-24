import createCreateTicketTool from '../../../../src/integrations/zendesk/tools/create-ticket';

const mockResponse = { ticket: { id: 99, subject: 'New ticket' } };

global.fetch = jest.fn().mockResolvedValue({
  json: () => Promise.resolve(mockResponse),
}) as jest.Mock;

describe('createCreateTicketTool', () => {
  const headers = { Authorization: 'Basic abc', 'Content-Type': 'application/json' };
  const baseUrl = 'https://test.zendesk.com/api/v2';

  beforeEach(() => jest.clearAllMocks());

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
        },
      }),
    });
  });
});
