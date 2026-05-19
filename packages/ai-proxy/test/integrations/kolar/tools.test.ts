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

  describe('id propagation', () => {
    it('sets RemoteTool.id on every produced tool when id is provided', () => {
      const tools = (
        getKolarTools as unknown as (
          cfg: typeof config,
          id?: string,
        ) => ReturnType<typeof getKolarTools>
      )(config, 'forest-kolar-7');

      expect(tools).not.toHaveLength(0);
      tools.forEach(tool => {
        expect((tool as ServerRemoteTool & { id?: string }).id).toBe('forest-kolar-7');
      });
    });

    it('leaves RemoteTool.id undefined when no id is provided (backwards-compatible call site)', () => {
      const tools = getKolarTools(config);

      tools.forEach(tool => {
        expect((tool as ServerRemoteTool & { id?: string }).id).toBeUndefined();
      });
    });
  });
});
