// Mock MCP server to avoid transitive dependency issues in tests
// The @forestadmin/mcp-server package has a dependency on @forestadmin-experimental/agent-nodejs-testing
// which is not available in the monorepo and creates circular dependencies
export const mockMcpGetHttpCallback = jest.fn().mockResolvedValue(jest.fn());
export const MockForestMCPServer = jest.fn().mockImplementation(() => ({
  getHttpCallback: mockMcpGetHttpCallback,
}));

jest.mock('@forestadmin/mcp-server', () => ({
  ForestMCPServer: MockForestMCPServer,
}));
