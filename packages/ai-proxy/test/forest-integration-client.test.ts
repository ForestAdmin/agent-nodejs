import ForestIntegrationClient from '../src/forest-integration-client';
import getKolarTools from '../src/integrations/kolar/tools';
import { validateKolarConfig } from '../src/integrations/kolar/utils';
import getSnowflakeTools from '../src/integrations/snowflake/tools';
import { validateSnowflakeConfig } from '../src/integrations/snowflake/utils';
import getZendeskTools from '../src/integrations/zendesk/tools';
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
          id: '1',
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
        [{ id: '1', integrationName: 'unknown', config: {} as any, isForestConnector: true }],
        logger,
      );

      await client.loadTools();

      expect(logger).toHaveBeenCalledWith('Warn', 'Unsupported integration: unknown');
    });

    it('should load kolar tools when integration is Kolar', async () => {
      const client = new ForestIntegrationClient([
        {
          id: '1',
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
          id: '1',
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
          id: '1',
          integrationName: 'Zendesk',
          config: { subdomain: 'a', email: 'a@b.com', apiToken: 'tok' },
          isForestConnector: true,
        },
        {
          id: '2',
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
        { id: '1', integrationName: 'Zendesk', config: zendeskConfig, isForestConnector: true },
      ]);

      await client.checkConnection();

      expect(validateZendeskConfig).toHaveBeenCalledWith(zendeskConfig);
    });

    it('should return true on success', async () => {
      const client = new ForestIntegrationClient([
        {
          id: '1',
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
        { id: '1', integrationName: 'Kolar', config: kolarConfig, isForestConnector: true },
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
        { id: '1', integrationName: 'Snowflake', config: snowflakeConfig, isForestConnector: true },
      ]);

      await client.checkConnection();

      expect(validateSnowflakeConfig).toHaveBeenCalledWith(snowflakeConfig);
    });

    it('should throw for unsupported integration', async () => {
      const client = new ForestIntegrationClient([
        // @ts-expect-error Testing unsupported integration
        { id: '1', integrationName: 'Unknown', config: {}, isForestConnector: true },
      ]);

      await expect(client.checkConnection()).rejects.toThrow('Unsupported integration: Unknown');
    });
  });

  describe('dispose', () => {
    it('should resolve without error', async () => {
      const client = new ForestIntegrationClient([]);

      await expect(client.dispose()).resolves.toBeUndefined();
    });
  });

  describe('ForestIntegrationConfig.id is threaded as mcpServerId into integration tool factories', () => {
    it('passes the config id to getZendeskTools so produced tools can be matched by step.mcpServerId', async () => {
      const client = new ForestIntegrationClient([
        {
          id: 'forest-zendesk-42',
          integrationName: 'Zendesk',
          config: { subdomain: 'test', email: 'a@b.com', apiToken: 'tok' },
          isForestConnector: true,
        },
      ]);

      await client.loadTools();

      expect(getZendeskTools).toHaveBeenCalledWith(
        expect.objectContaining({ subdomain: 'test' }),
        'forest-zendesk-42',
      );
    });

    it('passes the config id to getKolarTools', async () => {
      const client = new ForestIntegrationClient([
        {
          id: 'forest-kolar-7',
          integrationName: 'Kolar',
          config: { apiKey: 'key' },
          isForestConnector: true,
        },
      ]);

      await client.loadTools();

      expect(getKolarTools).toHaveBeenCalledWith(
        expect.objectContaining({ apiKey: 'key' }),
        'forest-kolar-7',
      );
    });

    it('passes the config id to getSnowflakeTools', async () => {
      const client = new ForestIntegrationClient([
        {
          id: 'forest-snowflake-99',
          integrationName: 'Snowflake',
          config: { accountIdentifier: 'a', programmaticAccessToken: 'tok' },
          isForestConnector: true,
        },
      ]);

      await client.loadTools();

      expect(getSnowflakeTools).toHaveBeenCalledWith(
        expect.objectContaining({ accountIdentifier: 'a' }),
        'forest-snowflake-99',
      );
    });

    it('passes undefined to the factory when the config entry has no id', async () => {
      const client = new ForestIntegrationClient([
        {
          integrationName: 'Zendesk',
          config: { subdomain: 'test', email: 'a@b.com', apiToken: 'tok' },
          isForestConnector: true,
        },
      ]);

      await client.loadTools();

      expect(getZendeskTools).toHaveBeenCalledWith(
        expect.objectContaining({ subdomain: 'test' }),
        undefined,
      );
    });
  });
});
