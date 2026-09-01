import * as factories from './__factories__';
import Agent from '../src/agent';

function buildAgent(): Agent {
  return new Agent(factories.forestAdminHttpDriverOptions.build());
}

describe('Agent.addBff', () => {
  it('should return the agent so it can be chained', () => {
    const agent = buildAgent();

    expect(agent.addBff()).toBe(agent);
  });

  it('should refuse a second call rather than silently keep the first', () => {
    const agent = buildAgent().addBff();

    expect(() => agent.addBff()).toThrow('addBff can only be called once.');
  });

  describe('when the MCP server already claims /bff', () => {
    it('should refuse, since the MCP server would shadow /bff/oauth and /bff/mcp', () => {
      const agent = buildAgent();
      agent.mountAiMcpServer({ basePath: '/bff' });

      expect(() => agent.addBff()).toThrow('Cannot use addBff together with mountAiMcpServer');
    });
  });

  describe('when the MCP server claims /bff after the BFF was added', () => {
    it('should refuse just the same, whichever order the two are called in', () => {
      const agent = buildAgent().addBff();

      expect(() => agent.mountAiMcpServer({ basePath: '/bff' })).toThrow(
        'Cannot use addBff together with mountAiMcpServer',
      );
    });
  });

  describe('when the MCP server is mounted elsewhere', () => {
    it('should accept both', () => {
      const agent = buildAgent();
      agent.mountAiMcpServer({ basePath: '/ai' });

      expect(() => agent.addBff()).not.toThrow();
    });
  });
});
