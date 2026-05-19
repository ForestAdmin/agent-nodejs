import getZendeskTools from '../../../src/integrations/zendesk/tools';
import ServerRemoteTool from '../../../src/server-remote-tool';

describe('getZendeskTools', () => {
  const config = { subdomain: 'mycompany', email: 'agent@test.com', apiToken: 'secret-token' };

  it('should return 6 tools wrapped in ServerRemoteTool', () => {
    const tools = getZendeskTools(config);

    expect(tools).toHaveLength(6);
    tools.forEach(tool => {
      expect(tool).toBeInstanceOf(ServerRemoteTool);
      expect(tool.sourceId).toBe('zendesk');
      expect(tool.sourceType).toBe('server');
    });
  });

  it('should return tools with expected names', () => {
    const tools = getZendeskTools(config);
    const names = tools.map(t => t.base.name);

    expect(names).toEqual([
      'zendesk_get_tickets',
      'zendesk_get_ticket',
      'zendesk_get_ticket_comments',
      'zendesk_create_ticket',
      'zendesk_create_ticket_comment',
      'zendesk_update_ticket',
    ]);
  });

  describe('id propagation', () => {
    it('sets RemoteTool.id on every produced tool when id is provided', () => {
      const tools = (
        getZendeskTools as unknown as (
          cfg: typeof config,
          id?: string,
        ) => ReturnType<typeof getZendeskTools>
      )(config, 'forest-zendesk-42');

      expect(tools).not.toHaveLength(0);
      tools.forEach(tool => {
        expect((tool as ServerRemoteTool & { id?: string }).id).toBe('forest-zendesk-42');
      });
    });

    it('leaves RemoteTool.id undefined when no id is provided (backwards-compatible call site)', () => {
      const tools = getZendeskTools(config);

      tools.forEach(tool => {
        expect((tool as ServerRemoteTool & { id?: string }).id).toBeUndefined();
      });
    });
  });
});
