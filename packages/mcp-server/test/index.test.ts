import {
  ForestMCPServer,
  ForestServerClientImpl,
  MCP_PATHS,
  createForestServerClient,
  createGatewaySwitch,
  isMcpRoute,
  loadFileUploads,
  normalizeMountPath,
  parseMcpEnv,
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

  it('should export createGatewaySwitch and normalizeMountPath', () => {
    expect(createGatewaySwitch({ basePath: '/ai' }).matches('/ai/mcp')).toBe(false);
    expect(normalizeMountPath('ai/', 'basePath')).toBe('/ai');
  });

  it('should export parseMcpEnv and loadFileUploads', async () => {
    expect(parseMcpEnv({ MCP_SERVER_PORT: '4000' }).listener).toEqual({
      port: 4000,
      publicUrl: undefined,
    });
    await expect(loadFileUploads(undefined)).resolves.toBeUndefined();
  });
});
