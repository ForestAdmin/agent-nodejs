import createGetTicketCommentsTool from '../../../../src/integrations/zendesk/tools/get-ticket-comments';

const mockResponse = { comments: [{ id: 1, body: 'Hello' }] };

global.fetch = jest.fn().mockResolvedValue({
  json: () => Promise.resolve(mockResponse),
}) as jest.Mock;

describe('createGetTicketCommentsTool', () => {
  const headers = { Authorization: 'Basic abc' };
  const baseUrl = 'https://test.zendesk.com/api/v2';

  beforeEach(() => jest.clearAllMocks());

  it('should fetch comments for a ticket', async () => {
    const tool = createGetTicketCommentsTool(headers, baseUrl);

    const result = await tool.invoke({ ticket_id: 10 });

    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/tickets/10/comments.json`, { headers });
    expect(result).toBe(JSON.stringify(mockResponse));
  });
});
