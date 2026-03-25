import McpConfigChecker from '../src/mcp-config-checker';
import * as zendeskUtils from '../src/integrations/zendesk/utils';
import McpClient from '../src/mcp-client';

jest.mock('../src/integrations/zendesk/utils');
jest.mock('../src/mcp-client');

describe('McpConfigChecker', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('isForestIntegrationConfig', () => {
    it('should return true when config has integrationName', () => {
      const config = {
        integrationName: 'Zendesk' as const,
        config: { subdomain: 'test', email: 'a@b.com', apiToken: 'tok' },
        isForestConnector: true as const,
      };

      expect(McpConfigChecker.isForestIntegrationConfig(config)).toBe(true);
    });

    it('should return false when config is an MCP configuration', () => {
      const config = { url: 'http://localhost:3000' };

      expect(McpConfigChecker.isForestIntegrationConfig(config as any)).toBe(false);
    });
  });

  describe('check', () => {
    it('should call validateZendeskConfig for Zendesk integration', async () => {
      const zendeskConfig = { subdomain: 'test', email: 'a@b.com', apiToken: 'tok' };
      const config = {
        integrationName: 'Zendesk' as const,
        config: zendeskConfig,
        isForestConnector: true as const,
      };

      await McpConfigChecker.check(config);

      expect(zendeskUtils.validateZendeskConfig).toHaveBeenCalledWith(zendeskConfig);
    });

    it('should throw for unsupported integration', () => {
      const config = {
        integrationName: 'Unknown',
        config: { subdomain: 'x', email: 'x', apiToken: 'x' },
        isForestConnector: true,
      } as any;

      expect(() => McpConfigChecker.check(config)).toThrow('Unsupported integration: Unknown');
    });

    it('should call McpClient.testConnections for MCP config', async () => {
      const testConnectionsMock = jest.fn().mockResolvedValue(undefined);
      (McpClient as jest.Mock).mockImplementation(() => ({
        testConnections: testConnectionsMock,
      }));
      const mcpConfig = { url: 'http://localhost:3000' };

      await McpConfigChecker.check(mcpConfig as any);

      expect(McpClient).toHaveBeenCalledWith(mcpConfig);
      expect(testConnectionsMock).toHaveBeenCalled();
    });
  });
});
