// Mock MCP server to avoid transitive dependency issues in tests
// The @forestadmin/mcp-server package has a dependency on @forestadmin/agent-client
export const mockMcpGetHttpCallback = jest.fn().mockResolvedValue(jest.fn());
export const MockForestMCPServer = jest.fn().mockImplementation(() => ({
  getHttpCallback: mockMcpGetHttpCallback,
}));

jest.mock('@forestadmin/mcp-server', () => ({
  ForestMCPServer: MockForestMCPServer,
}));
