import ForestIntegrationClient from '../src/forest-integration-client';
import { validateKolarConfig } from '../src/integrations/kolar/utils';
import { validateSnowflakeConfig } from '../src/integrations/snowflake/utils';
import { validateZendeskConfig } from '../src/integrations/zendesk/utils';

const mockZendeskTools = [{ name: 'zendesk_get_tickets' }, { name: 'zendesk_get_ticket' }];
const mockKolarTools = [{ name: 'kolar_screen_transaction' }, { name: 'kolar_get_result' }];
const mockSnowflakeTools = [
  { name: 'snowflake_cortex_search' },
  { name: 'snowflake_cortex_analyst' },
  { name: 'snowflake_execute_query' },
];

jest.mock('../src/integrations/zendesk/tools', () => ({
  __esModule: true,
  default: jest.fn(() => mockZendeskTools),
}));

jest.mock('../src/integrations/kolar/tools', () => ({
  __esModule: true,
  default: jest.fn(() => mockKolarTools),
}));

jest.mock('../src/integrations/snowflake/tools', () => ({
  __esModule: true,
  default: jest.fn(() => mockSnowflakeTools),
}));

jest.mock('../src/integrations/zendesk/utils');
jest.mock('../src/integrations/kolar/utils');
jest.mock('../src/integrations/snowflake/utils');

describe('ForestIntegrationClient', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('loadTools', () => {
    it('should load zendesk tools when integration is zendesk', async () => {
      const client = new ForestIntegrationClient([
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
      const client = new ForestIntegrationClient(
        // @ts-expect-error Testing unsupported integration
        [{ integrationName: 'unknown', config: {} as any, isForestConnector: true }],
        logger,
      );

      await client.loadTools();

      expect(logger).toHaveBeenCalledWith('Warn', 'Unsupported integration: unknown');
    });

    it('should load kolar tools when integration is Kolar', async () => {
      const client = new ForestIntegrationClient([
        {
          integrationName: 'Kolar',
          config: { apiKey: 'key' },
          isForestConnector: true,
        },
      ]);

      const tools = await client.loadTools();

      expect(tools).toEqual(mockKolarTools);
    });

    it('should load snowflake tools when integration is Snowflake', async () => {
      const client = new ForestIntegrationClient([
        {
          integrationName: 'Snowflake',
          config: {
            accountIdentifier: 'a',
            programmaticAccessToken: 'tok',
          },
          isForestConnector: true,
        },
      ]);

      const tools = await client.loadTools();

      expect(tools).toEqual(mockSnowflakeTools);
    });

    it('should return empty array when no configs', async () => {
      const client = new ForestIntegrationClient([]);

      expect(await client.loadTools()).toEqual([]);
    });

    it('should load tools from multiple configs', async () => {
      const client = new ForestIntegrationClient([
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
      const client = new ForestIntegrationClient([
        { integrationName: 'Zendesk', config: zendeskConfig, isForestConnector: true },
      ]);

      await client.checkConnection();

      expect(validateZendeskConfig).toHaveBeenCalledWith(zendeskConfig);
    });

    it('should return true on success', async () => {
      const client = new ForestIntegrationClient([
        {
          integrationName: 'Zendesk',
          config: { subdomain: 'test', email: 'a@b.com', apiToken: 'tok' },
          isForestConnector: true,
        },
      ]);

      const result = await client.checkConnection();

      expect(result).toBe(true);
    });

    it('should call validateKolarConfig for Kolar integration', async () => {
      const kolarConfig = { apiKey: 'key' };
      const client = new ForestIntegrationClient([
        { integrationName: 'Kolar', config: kolarConfig, isForestConnector: true },
      ]);

      await client.checkConnection();

      expect(validateKolarConfig).toHaveBeenCalledWith(kolarConfig);
    });

    it('should call validateSnowflakeConfig for Snowflake integration', async () => {
      const snowflakeConfig = {
        accountIdentifier: 'a',
        programmaticAccessToken: 'tok',
      };
      const client = new ForestIntegrationClient([
        { integrationName: 'Snowflake', config: snowflakeConfig, isForestConnector: true },
      ]);

      await client.checkConnection();

      expect(validateSnowflakeConfig).toHaveBeenCalledWith(snowflakeConfig);
    });

    it('should throw for unsupported integration', async () => {
      const client = new ForestIntegrationClient([
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
      const client = new ForestIntegrationClient([]);

      await expect(client.dispose()).resolves.toBeUndefined();
    });
  });
});
