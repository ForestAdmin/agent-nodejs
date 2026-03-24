import createCreateTicketCommentTool from '../../../../src/integrations/zendesk/tools/create-ticket-comment';

const mockResponse = { ticket: { id: 5 } };

global.fetch = jest.fn().mockResolvedValue({
  json: () => Promise.resolve(mockResponse),
}) as jest.Mock;

describe('createCreateTicketCommentTool', () => {
  const headers = { Authorization: 'Basic abc', 'Content-Type': 'application/json' };
  const baseUrl = 'https://test.zendesk.com/api/v2';

  beforeEach(() => jest.clearAllMocks());

  it('should add a public comment by default', async () => {
    const tool = createCreateTicketCommentTool(headers, baseUrl);

    const result = await tool.invoke({ ticket_id: 5, comment: 'Looks good' });

    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/tickets/5.json`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        ticket: { comment: { body: 'Looks good', public: true } },
      }),
    });
    expect(result).toBe(JSON.stringify(mockResponse));
  });

  it('should add an internal comment when public is false', async () => {
    const tool = createCreateTicketCommentTool(headers, baseUrl);

    await tool.invoke({ ticket_id: 5, comment: 'Internal note', public: false });

    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/tickets/5.json`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        ticket: { comment: { body: 'Internal note', public: false } },
      }),
    });
  });
});
