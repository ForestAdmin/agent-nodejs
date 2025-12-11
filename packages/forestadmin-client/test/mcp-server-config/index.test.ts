import McpServerConfigFromApiService from '../../src/mcp-server-config';
import * as factories from '../__factories__';

describe('McpServerConfigFromApiService', () => {
  describe('getConfiguration', () => {
    it('should call getMcpServerConfigs on the server interface', async () => {
      const mcpConfig = {
        mcpServers: [{ name: 'server1', url: 'http://localhost:3000' }],
      };
      const serverInterface = factories.forestAdminServerInterface.build();
      (serverInterface.getMcpServerConfigs as jest.Mock).mockResolvedValue(mcpConfig);

      const options = factories.forestAdminClientOptions.build();
      const service = new McpServerConfigFromApiService(serverInterface, options);

      const result = await service.getConfiguration();

      expect(serverInterface.getMcpServerConfigs).toHaveBeenCalledWith(options);
      expect(result).toEqual(mcpConfig);
    });

    it('should return empty mcpServers when server returns empty config', async () => {
      const mcpConfig = { mcpServers: [] };
      const serverInterface = factories.forestAdminServerInterface.build();
      (serverInterface.getMcpServerConfigs as jest.Mock).mockResolvedValue(mcpConfig);

      const options = factories.forestAdminClientOptions.build();
      const service = new McpServerConfigFromApiService(serverInterface, options);

      const result = await service.getConfiguration();

      expect(result).toEqual({ mcpServers: [] });
    });
  });
});
