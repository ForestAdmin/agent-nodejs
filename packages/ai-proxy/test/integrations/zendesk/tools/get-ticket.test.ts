import createGetTicketTool from '../../../../src/integrations/zendesk/tools/get-ticket';

const mockResponse = { ticket: { id: 42, subject: 'Help' } };

global.fetch = jest.fn().mockResolvedValue({
  json: () => Promise.resolve(mockResponse),
}) as jest.Mock;

describe('createGetTicketTool', () => {
  const headers = { Authorization: 'Basic abc' };
  const baseUrl = 'https://test.zendesk.com/api/v2';

  beforeEach(() => jest.clearAllMocks());

  it('should fetch the ticket by id', async () => {
    const tool = createGetTicketTool(headers, baseUrl);

    const result = await tool.invoke({ ticket_id: 42 });

    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/tickets/42.json`, { headers });
    expect(result).toBe(JSON.stringify(mockResponse));
  });
});
