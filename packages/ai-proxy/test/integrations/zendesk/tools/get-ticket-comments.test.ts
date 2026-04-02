import createGetTicketCommentsTool from '../../../../src/integrations/zendesk/tools/get-ticket-comments';

const mockResponse = { comments: [{ id: 1, body: 'Hello' }] };

global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve(mockResponse),
}) as jest.Mock;

describe('createGetTicketCommentsTool', () => {
  const headers = { Authorization: 'Basic abc' };
  const baseUrl = 'https://test.zendesk.com/api/v2';

  beforeEach(() => jest.clearAllMocks());

  it('should throw on HTTP error', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ error: 'RecordNotFound' }),
    });

    const tool = createGetTicketCommentsTool(headers, baseUrl);

    await expect(tool.invoke({ ticket_id: 999 })).rejects.toThrow(
      'Zendesk get ticket comments failed (404): RecordNotFound',
    );
  });

  it('should fetch comments for a ticket', async () => {
    const tool = createGetTicketCommentsTool(headers, baseUrl);

    const result = await tool.invoke({ ticket_id: 10 });

    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/tickets/10/comments.json`, { headers });
    expect(result).toBe(JSON.stringify(mockResponse));
  });
});
