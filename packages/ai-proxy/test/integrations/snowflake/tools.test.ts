import getSnowflakeTools, { type SnowflakeConfig } from '../../../src/integrations/snowflake/tools';
import ServerRemoteTool from '../../../src/server-remote-tool';

describe('getSnowflakeTools', () => {
  const config: SnowflakeConfig = {
    accountIdentifier: 'my-account',
    programmaticAccessToken: 'pat-secret',
  };

  it('should return 3 tools wrapped in ServerRemoteTool', () => {
    const tools = getSnowflakeTools(config);

    expect(tools).toHaveLength(3);
    tools.forEach(tool => {
      expect(tool).toBeInstanceOf(ServerRemoteTool);
      expect(tool.sourceId).toBe('snowflake');
      expect(tool.sourceType).toBe('server');
    });
  });

  it('should return tools with expected names', () => {
    const tools = getSnowflakeTools(config);
    const names = tools.map(t => t.base.name);

    expect(names).toEqual([
      'snowflake_cortex_search',
      'snowflake_cortex_analyst',
      'snowflake_execute_query',
    ]);
  });

  describe('mcpServerId propagation', () => {
    it('sets RemoteTool.mcpServerId on every produced tool when mcpServerId is provided', () => {
      const tools = getSnowflakeTools(config, 'forest-snowflake-99');

      expect(tools).not.toHaveLength(0);
      tools.forEach(tool => {
        expect(tool.mcpServerId).toBe('forest-snowflake-99');
      });
    });

    it('leaves RemoteTool.mcpServerId undefined when no mcpServerId is provided', () => {
      const tools = getSnowflakeTools(config);

      tools.forEach(tool => {
        expect(tool.mcpServerId).toBeUndefined();
      });
    });
  });
});
