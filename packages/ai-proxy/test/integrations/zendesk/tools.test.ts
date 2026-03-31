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
});
