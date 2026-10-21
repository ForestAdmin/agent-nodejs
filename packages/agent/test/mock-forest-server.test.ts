import http from 'http';
import https from 'https';
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

  describe('requests that bypass the superagent and fetch mocks', () => {
    const requestOutside = () =>
      new Promise<Error>(resolve => {
        https
          .get('https://forest-mock-guard.invalid/oidc/reg', () => resolve(null))
          .on('error', resolve);
      });

    it('should refuse them while the mock is set up, as openid-client and eventsource send them', async () => {
      const mock = new MockForestServer().setupDefaultRoutes().setupSuperagentMock();

      try {
        expect((await requestOutside()).name).toBe('NetConnectNotAllowedError');
      } finally {
        mock.restore();
      }
    });

    it('should still let requests reach the local test servers', async () => {
      const server = http.createServer((_, response) => response.end('ok'));
      await new Promise<void>(resolve => {
        server.listen(0, '127.0.0.1', resolve);
      });
      const { port } = server.address() as { port: number };
      const mock = new MockForestServer().setupDefaultRoutes().setupSuperagentMock();

      try {
        const status = await new Promise<number>((resolve, reject) => {
          http
            .get(`http://127.0.0.1:${port}`, response => resolve(response.statusCode))
            .on('error', reject);
        });

        expect(status).toBe(200);
      } finally {
        mock.restore();
        server.close();
      }
    });

    it('should let them through again after restore', async () => {
      new MockForestServer().setupDefaultRoutes().setupSuperagentMock().restore();

      expect((await requestOutside()).name).not.toBe('NetConnectNotAllowedError');
    });
  });
});
