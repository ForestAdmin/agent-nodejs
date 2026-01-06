import {
  createForestServerClient,
  ForestMCPServer,
  ForestServerClientImpl,
  isMcpRoute,
  MCP_PATHS,
} from '../src';

describe('mcp-server exports', () => {
  it('should export ForestMCPServer', () => {
    expect(ForestMCPServer).toBeDefined();
  });

  it('should export MCP_PATHS and isMcpRoute', () => {
    expect(MCP_PATHS).toBeDefined();
    expect(isMcpRoute).toBeDefined();
    expect(typeof isMcpRoute).toBe('function');
  });

  it('should export ForestServerClientImpl', () => {
    expect(ForestServerClientImpl).toBeDefined();
    expect(typeof ForestServerClientImpl).toBe('function');
  });

  it('should export createForestServerClient', () => {
    expect(createForestServerClient).toBeDefined();
    expect(typeof createForestServerClient).toBe('function');
  });
});
