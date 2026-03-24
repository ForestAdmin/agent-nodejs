import getIntegratedTools from '../../src/integrations/tools';

const mockBraveTools = [{ name: 'brave_search' }];
const mockZendeskTools = [{ name: 'zendesk_get_tickets' }];

jest.mock('../../src/integrations/brave/tools', () => ({
  __esModule: true,
  default: jest.fn(() => mockBraveTools),
}));

jest.mock('../../src/integrations/zendesk/tools', () => ({
  __esModule: true,
  default: jest.fn(() => mockZendeskTools),
}));

describe('getIntegratedTools', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return empty array when no configs provided', () => {
    expect(getIntegratedTools({})).toEqual([]);
  });

  it('should return brave tools when brave config provided', () => {
    const tools = getIntegratedTools({ brave: { apiKey: 'key' } });

    expect(tools).toEqual(mockBraveTools);
  });

  it('should return zendesk tools when zendesk config provided', () => {
    const tools = getIntegratedTools({
      zendesk: { subdomain: 'test', email: 'a@b.com', apiToken: 'tok' },
    });

    expect(tools).toEqual(mockZendeskTools);
  });

  it('should return all tools when all configs provided', () => {
    const tools = getIntegratedTools({
      brave: { apiKey: 'key' },
      zendesk: { subdomain: 'test', email: 'a@b.com', apiToken: 'tok' },
    });

    expect(tools).toEqual([...mockBraveTools, ...mockZendeskTools]);
  });
});
