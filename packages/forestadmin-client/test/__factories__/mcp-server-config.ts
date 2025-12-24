import type { McpServerConfigService } from '../../src/mcp-server-config/types';

const mcpServerConfig = {
  build: (overrides?: Partial<McpServerConfigService>): McpServerConfigService => ({
    getConfiguration: jest.fn().mockResolvedValue({ mcpServers: [] }),
    ...overrides,
  }),
};

export default mcpServerConfig;
