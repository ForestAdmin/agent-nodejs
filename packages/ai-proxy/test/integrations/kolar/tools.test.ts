import getKolarTools from '../../../src/integrations/kolar/tools';
import ServerRemoteTool from '../../../src/server-remote-tool';

describe('getKolarTools', () => {
  const config = { apiKey: 'test-api-key' };

  it('should return 4 tools wrapped in ServerRemoteTool', () => {
    const tools = getKolarTools(config);

    expect(tools).toHaveLength(4);
    tools.forEach(tool => {
      expect(tool).toBeInstanceOf(ServerRemoteTool);
      expect(tool.sourceId).toBe('kolar');
      expect(tool.sourceType).toBe('server');
    });
  });

  it('should return tools with expected names', () => {
    const tools = getKolarTools(config);
    const names = tools.map(t => t.base.name);

    expect(names).toEqual([
      'kolar_create_merchant_application',
      'kolar_get_merchant_application_result',
      'kolar_screen_transaction',
      'kolar_get_screening_result',
    ]);
  });

  describe('mcpServerId propagation', () => {
    it('sets RemoteTool.mcpServerId on every produced tool when mcpServerId is provided', () => {
      const tools = getKolarTools(config, 'forest-kolar-7');

      expect(tools).not.toHaveLength(0);
      tools.forEach(tool => {
        expect(tool.mcpServerId).toBe('forest-kolar-7');
      });
    });

    it('leaves RemoteTool.mcpServerId undefined when no mcpServerId is provided', () => {
      const tools = getKolarTools(config);

      tools.forEach(tool => {
        expect(tool.mcpServerId).toBeUndefined();
      });
    });
  });
});
