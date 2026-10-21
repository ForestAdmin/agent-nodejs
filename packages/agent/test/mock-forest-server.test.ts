import superagent from 'superagent';

import MockForestServer from './__helper__/mock-forest-server';

const STATUS_URL =
  'https://api.forestadmin.com/api/activity-logs-requests/logs-2024/activity-log-1/status';

describe('MockForestServer default routes', () => {
  it('should answer the activity log status update the MCP server sends after each tool call', async () => {
    const mock = new MockForestServer().setupDefaultRoutes();

    const response = await mock.fetch(STATUS_URL, { method: 'PATCH' });

    expect(response.status).toBe(200);
  });

  it('should intercept superagent PATCH requests to the Forest Admin API', async () => {
    const mock = new MockForestServer().setupDefaultRoutes().setupSuperagentMock();

    try {
      const response = await superagent.patch(STATUS_URL).send({ status: 'completed' });

      expect(response.status).toBe(200);
    } finally {
      mock.restore();
    }
  });
});
