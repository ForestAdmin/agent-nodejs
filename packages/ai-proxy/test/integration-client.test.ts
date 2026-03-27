import IntegrationClient from '../src/integration-client';
import { validateZendeskConfig } from '../src/integrations/zendesk/utils';

const mockZendeskTools = [{ name: 'zendesk_get_tickets' }, { name: 'zendesk_get_ticket' }];

jest.mock('../src/integrations/zendesk/tools', () => ({
  __esModule: true,
  default: jest.fn(() => mockZendeskTools),
}));

jest.mock('../src/integrations/zendesk/utils');

describe('IntegrationClient', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('loadTools', () => {
    it('should load zendesk tools when integration is zendesk', async () => {
      const client = new IntegrationClient([
        {
          integrationName: 'Zendesk',
          config: { subdomain: 'test', email: 'a@b.com', apiToken: 'tok' },
          isForestConnector: true,
        },
      ]);

      const tools = await client.loadTools();

      expect(tools).toEqual(mockZendeskTools);
    });

    it('should log warning for unsupported integration', async () => {
      const logger = jest.fn();
      const client = new IntegrationClient(
        // @ts-expect-error Testing unsupported integration
        [{ integrationName: 'unknown', config: {} as any, isForestConnector: true }],
        logger,
      );

      await client.loadTools();

      expect(logger).toHaveBeenCalledWith('Warn', 'Unsupported integration: unknown');
    });

    it('should return empty array when no configs', async () => {
      const client = new IntegrationClient([]);

      expect(await client.loadTools()).toEqual([]);
    });

    it('should load tools from multiple configs', async () => {
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

      const tools = await client.loadTools();

      expect(tools).toHaveLength(4);
    });
  });

  describe('checkConnection', () => {
    it('should call validateZendeskConfig for Zendesk integration', async () => {
      const zendeskConfig = { subdomain: 'test', email: 'a@b.com', apiToken: 'tok' };
      const client = new IntegrationClient([
        { integrationName: 'Zendesk', config: zendeskConfig, isForestConnector: true },
      ]);

      await client.checkConnection();

      expect(validateZendeskConfig).toHaveBeenCalledWith(zendeskConfig);
    });

    it('should return true on success', async () => {
      const client = new IntegrationClient([
        {
          integrationName: 'Zendesk',
          config: { subdomain: 'test', email: 'a@b.com', apiToken: 'tok' },
          isForestConnector: true,
        },
      ]);

      const result = await client.checkConnection();

      expect(result).toBe(true);
    });

    it('should throw for unsupported integration', async () => {
      const client = new IntegrationClient([
        // @ts-expect-error Testing unsupported integration
        { integrationName: 'Unknown', config: {}, isForestConnector: true },
      ]);

      await expect(client.checkConnection()).rejects.toThrow(
        'Unsupported integration: Unknown',
      );
    });
  });

  describe('dispose', () => {
    it('should resolve without error', async () => {
      const client = new IntegrationClient([]);

      await expect(client.dispose()).resolves.toBeUndefined();
    });
  });
});
