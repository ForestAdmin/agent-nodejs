import IntegrationClient from '../src/integration-client';

const mockZendeskTools = [{ name: 'zendesk_get_tickets' }, { name: 'zendesk_get_ticket' }];

jest.mock('../src/integrations/zendesk/tools', () => ({
  __esModule: true,
  default: jest.fn(() => mockZendeskTools),
}));

describe('IntegrationClient', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('loadTools', () => {
    it('should load zendesk tools when integration is zendesk', () => {
      const client = new IntegrationClient([
        {
          integrationName: 'Zendesk',
          config: { subdomain: 'test', email: 'a@b.com', apiToken: 'tok' },
          isForestConnector: true,
        },
      ]);

      const tools = client.loadTools();

      expect(tools).toEqual(mockZendeskTools);
    });

    it('should log warning for unsupported integration', () => {
      const logger = jest.fn();
      const client = new IntegrationClient(
        // @ts-expect-error Testing unsupported integration
        [{ integrationName: 'unknown', config: {} as any, isForestConnector: true }],
        logger,
      );

      client.loadTools();

      expect(logger).toHaveBeenCalledWith('Warn', 'Unsupported integration: unknown');
    });

    it('should return empty array when no configs', () => {
      const client = new IntegrationClient([]);

      expect(client.loadTools()).toEqual([]);
    });

    it('should load tools from multiple configs', () => {
      const client = new IntegrationClient([
        {
          integrationName: 'Zendesk',
          config: { subdomain: 'a', email: 'a@b.com', apiToken: 'tok' },
          isForestConnector: true,
        },
        {
          integrationName: 'Zendesk',
          config: { subdomain: 'b', email: 'c@d.com', apiToken: 'tok2' },
          isForestConnector: true,
        },
      ]);

      const tools = client.loadTools();

      expect(tools).toHaveLength(4);
    });
  });
});
