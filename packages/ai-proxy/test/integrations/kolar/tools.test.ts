import getKolarTools from '../../../src/integrations/kolar/tools';
import ServerRemoteTool from '../../../src/server-remote-tool';

describe('getKolarTools', () => {
  const config = { username: 'admin', password: 'secret' };

  it('should return 5 tools wrapped in ServerRemoteTool', () => {
    const tools = getKolarTools(config);

    expect(tools).toHaveLength(5);
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
      'kolar_screen_transaction',
      'kolar_get_screening_result',
      'kolar_update_decision',
      'kolar_list_pending_reviews',
      'kolar_get_entity_profile',
    ]);
  });
});
