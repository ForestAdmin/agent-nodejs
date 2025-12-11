import McpServerConfigFromApiService from '../../src/mcp-server-config';
import * as factories from '../__factories__';

describe('McpServerConfigFromApiService', () => {
  describe('getConfiguration', () => {
    it('should call getMcpServerConfigs on the server interface', async () => {
      const mcpConfig = {
        configs: { server1: { transport: 'sse', url: 'http://localhost:3000' } },
      };
      const serverInterface = factories.forestAdminServerInterface.build();
      (serverInterface.getMcpServerConfigs as jest.Mock).mockResolvedValue(mcpConfig);

      const options = factories.forestAdminClientOptions.build();
      const service = new McpServerConfigFromApiService(serverInterface, options);

      const result = await service.getConfiguration();

      expect(serverInterface.getMcpServerConfigs).toHaveBeenCalledWith(options);
      expect(result).toEqual(mcpConfig);
    });

    it('should return empty configs when server returns empty config', async () => {
      const mcpConfig = { configs: {} };
      const serverInterface = factories.forestAdminServerInterface.build();
      (serverInterface.getMcpServerConfigs as jest.Mock).mockResolvedValue(mcpConfig);

      const options = factories.forestAdminClientOptions.build();
      const service = new McpServerConfigFromApiService(serverInterface, options);

      const result = await service.getConfiguration();

      expect(result).toEqual({ configs: {} });
    });

    it('should return config with multiple SSE servers', async () => {
      const mcpConfig = {
        configs: {
          zendesk: { transport: 'sse', url: 'http://localhost:3001/sse' },
          slack: { transport: 'sse', url: 'http://localhost:3002/sse' },
          github: { transport: 'sse', url: 'http://localhost:3003/sse' },
        },
      };
      const serverInterface = factories.forestAdminServerInterface.build();
      (serverInterface.getMcpServerConfigs as jest.Mock).mockResolvedValue(mcpConfig);

      const options = factories.forestAdminClientOptions.build();
      const service = new McpServerConfigFromApiService(serverInterface, options);

      const result = await service.getConfiguration();

      expect(result).toEqual(mcpConfig);
      expect(Object.keys(result.configs)).toHaveLength(3);
    });

    it('should return config with stdio transport server', async () => {
      const mcpConfig = {
        configs: {
          localServer: {
            transport: 'stdio',
            command: 'node',
            args: ['./server.js'],
          },
        },
      };
      const serverInterface = factories.forestAdminServerInterface.build();
      (serverInterface.getMcpServerConfigs as jest.Mock).mockResolvedValue(mcpConfig);

      const options = factories.forestAdminClientOptions.build();
      const service = new McpServerConfigFromApiService(serverInterface, options);

      const result = await service.getConfiguration();

      expect(result).toEqual(mcpConfig);
      expect(result.configs.localServer).toMatchObject({
        transport: 'stdio',
        command: 'node',
        args: ['./server.js'],
      });
    });

    it('should return config with mixed transport types', async () => {
      const mcpConfig = {
        configs: {
          remoteServer: { transport: 'sse', url: 'http://remote.example.com/sse' },
          localServer: {
            transport: 'stdio',
            command: 'python',
            args: ['-m', 'mcp_server'],
            env: { DEBUG: 'true' },
          },
        },
      };
      const serverInterface = factories.forestAdminServerInterface.build();
      (serverInterface.getMcpServerConfigs as jest.Mock).mockResolvedValue(mcpConfig);

      const options = factories.forestAdminClientOptions.build();
      const service = new McpServerConfigFromApiService(serverInterface, options);

      const result = await service.getConfiguration();

      expect(result).toEqual(mcpConfig);
      expect(result.configs.remoteServer.transport).toBe('sse');
      expect(result.configs.localServer.transport).toBe('stdio');
    });
  });
});
