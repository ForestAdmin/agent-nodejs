import http from 'http';

import { createRemoteAgentClient } from '../../src/index';

/**
 * Integration tests for RemoteAgentClient
 *
 * These tests use a real HTTP server to verify the full request/response flow
 */
describe('RemoteAgentClient Integration', () => {
  let server: http.Server;
  let serverPort: number;
  let requestLog: Array<{
    method: string;
    url: string;
    headers: http.IncomingHttpHeaders;
    body: string;
  }>;

  // Helper to create JSON API response
  const createJsonApiResponse = (data: any) => ({
    data: Array.isArray(data)
      ? data.map((item, index) => ({
          id: item.id || String(index + 1),
          type: 'record',
          attributes: item,
        }))
      : {
          id: data.id || '1',
          type: 'record',
          attributes: data,
        },
  });

  beforeAll(() => {
    requestLog = [];

    server = http.createServer((req, res) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
      });

      req.on('end', () => {
        requestLog.push({
          method: req.method!,
          url: req.url!,
          headers: req.headers,
          body,
        });

        res.setHeader('Content-Type', 'application/json');

        // Route handling
        const url = new URL(req.url!, `http://localhost:${serverPort}`);
        const { pathname } = url;

        // List users
        if (req.method === 'GET' && pathname === '/forest/users') {
          const response = createJsonApiResponse([
            { id: '1', name: 'John Doe', email: 'john@example.com' },
            { id: '2', name: 'Jane Doe', email: 'jane@example.com' },
          ]);
          res.statusCode = 200;
          res.end(JSON.stringify(response));

          return;
        }

        // Count users
        if (req.method === 'GET' && pathname === '/forest/users/count') {
          res.statusCode = 200;
          res.end(JSON.stringify({ count: 42 }));

          return;
        }

        // Create user
        if (req.method === 'POST' && pathname === '/forest/users') {
          const parsedBody = JSON.parse(body);
          const response = createJsonApiResponse({
            id: '3',
            ...parsedBody.data.attributes,
          });
          res.statusCode = 201;
          res.end(JSON.stringify(response));

          return;
        }

        // Update user
        if (req.method === 'PUT' && pathname.match(/^\/forest\/users\/\d+$/)) {
          const parsedBody = JSON.parse(body);
          const response = createJsonApiResponse({
            ...parsedBody.data.attributes,
            id: parsedBody.data.id,
          });
          res.statusCode = 200;
          res.end(JSON.stringify(response));

          return;
        }

        // Delete users
        if (req.method === 'DELETE' && pathname === '/forest/users') {
          res.statusCode = 204;
          res.end();

          return;
        }

        // List user relations (posts)
        if (
          req.method === 'GET' &&
          pathname.match(/^\/forest\/users\/\d+\/relationships\/posts$/)
        ) {
          const response = createJsonApiResponse([
            { id: '1', title: 'First Post', content: 'Hello World' },
            { id: '2', title: 'Second Post', content: 'Another post' },
          ]);
          res.statusCode = 200;
          res.end(JSON.stringify(response));

          return;
        }

        // Execute action
        if (req.method === 'POST' && pathname === '/forest/actions/send-email') {
          res.statusCode = 200;
          res.end(JSON.stringify({ success: 'Email sent successfully' }));

          return;
        }

        // Get action form (for field loading)
        if (req.method === 'POST' && pathname === '/forest/actions/send-email/hooks/load') {
          res.statusCode = 200;
          res.end(
            JSON.stringify({
              fields: [
                { field: 'email', type: 'String', value: '' },
                { field: 'subject', type: 'String', value: '' },
              ],
            }),
          );

          return;
        }

        // Default 404
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'Not found' }));
      });
    });

    return new Promise<void>(resolve => {
      server.listen(0, () => {
        serverPort = (server.address() as any).port;
        resolve();
      });
    });
  });

  afterAll(() => {
    return new Promise<void>(resolve => {
      server.close(() => resolve());
    });
  });

  beforeEach(() => {
    requestLog = [];
  });

  describe('Collection operations', () => {
    it('should list records from a collection', async () => {
      const client = createRemoteAgentClient({
        url: `http://localhost:${serverPort}`,
        token: 'test-token',
      });

      const users = await client.collection('users').list();

      expect(users).toHaveLength(2);
      expect(users[0]).toMatchObject({ name: 'John Doe', email: 'john@example.com' });
      expect(users[1]).toMatchObject({ name: 'Jane Doe', email: 'jane@example.com' });

      // Verify request
      expect(requestLog).toHaveLength(1);
      expect(requestLog[0].method).toBe('GET');
      expect(requestLog[0].url).toContain('/forest/users');
      expect(requestLog[0].headers.authorization).toBe('Bearer test-token');
    });

    it('should count records in a collection', async () => {
      const client = createRemoteAgentClient({
        url: `http://localhost:${serverPort}`,
        token: 'test-token',
      });

      const count = await client.collection('users').count();

      expect(count).toBe(42);

      expect(requestLog[0].url).toContain('/forest/users/count');
    });

    it('should create a record', async () => {
      const client = createRemoteAgentClient({
        url: `http://localhost:${serverPort}`,
        token: 'test-token',
      });

      const newUser = await client.collection('users').create({
        name: 'New User',
        email: 'new@example.com',
      });

      expect(newUser).toMatchObject({
        name: 'New User',
        email: 'new@example.com',
      });

      // Verify request body
      const requestBody = JSON.parse(requestLog[0].body);
      expect(requestBody.data.attributes).toMatchObject({
        name: 'New User',
        email: 'new@example.com',
      });
    });

    it('should update a record', async () => {
      const client = createRemoteAgentClient({
        url: `http://localhost:${serverPort}`,
        token: 'test-token',
      });

      const updatedUser = await client.collection('users').update(1, {
        name: 'Updated Name',
      });

      expect(updatedUser).toMatchObject({ name: 'Updated Name' });

      expect(requestLog[0].method).toBe('PUT');
      expect(requestLog[0].url).toContain('/forest/users/1');
    });

    it('should delete records', async () => {
      const client = createRemoteAgentClient({
        url: `http://localhost:${serverPort}`,
        token: 'test-token',
      });

      await client.collection('users').delete([1, 2]);

      expect(requestLog[0].method).toBe('DELETE');
      const requestBody = JSON.parse(requestLog[0].body);
      expect(requestBody.data.attributes.ids).toEqual(['1', '2']);
    });

    it('should search records', async () => {
      const client = createRemoteAgentClient({
        url: `http://localhost:${serverPort}`,
        token: 'test-token',
      });

      await client.collection('users').search('john');

      expect(requestLog[0].url).toContain('search=john');
    });
  });

  describe('Relation operations', () => {
    it('should list related records', async () => {
      const client = createRemoteAgentClient({
        url: `http://localhost:${serverPort}`,
        token: 'test-token',
      });

      const posts = await client.collection('users').relation('posts', 1).list();

      expect(posts).toHaveLength(2);
      expect(posts[0]).toMatchObject({ title: 'First Post' });

      expect(requestLog[0].url).toContain('/forest/users/1/relationships/posts');
    });
  });

  describe('Segment operations', () => {
    it('should list records from a segment', async () => {
      const client = createRemoteAgentClient({
        url: `http://localhost:${serverPort}`,
        token: 'test-token',
      });

      await client.collection('users').segment('active').list();

      expect(requestLog[0].url).toContain('segment=active');
    });
  });

  describe('Query parameters', () => {
    it('should send pagination parameters', async () => {
      const client = createRemoteAgentClient({
        url: `http://localhost:${serverPort}`,
        token: 'test-token',
      });

      await client.collection('users').list({
        pagination: { size: 10, number: 2 },
      });

      const { url } = requestLog[0];
      expect(url).toContain('page%5Bsize%5D=10');
      expect(url).toContain('page%5Bnumber%5D=2');
    });

    it('should send sort parameters', async () => {
      const client = createRemoteAgentClient({
        url: `http://localhost:${serverPort}`,
        token: 'test-token',
      });

      await client.collection('users').list({
        sort: { field: 'name', ascending: false },
      });

      expect(requestLog[0].url).toContain('sort=-name');
    });

    it('should send filter parameters', async () => {
      const client = createRemoteAgentClient({
        url: `http://localhost:${serverPort}`,
        token: 'test-token',
      });

      await client.collection('users').list({
        filters: {
          conditionTree: {
            field: 'status',
            operator: 'Equal',
            value: 'active',
          },
        },
      } as any);

      expect(requestLog[0].url).toContain('filters=');
    });
  });

  describe('Error handling', () => {
    it('should throw error for not found resources', async () => {
      const client = createRemoteAgentClient({
        url: `http://localhost:${serverPort}`,
        token: 'test-token',
      });

      await expect(client.collection('nonexistent').list()).rejects.toThrow();
    });
  });

  describe('Authentication', () => {
    it('should send authorization header with token', async () => {
      const client = createRemoteAgentClient({
        url: `http://localhost:${serverPort}`,
        token: 'my-secret-token',
      });

      await client.collection('users').list();

      expect(requestLog[0].headers.authorization).toBe('Bearer my-secret-token');
    });

    it('should send correct content-type header', async () => {
      const client = createRemoteAgentClient({
        url: `http://localhost:${serverPort}`,
        token: 'test-token',
      });

      await client.collection('users').list();

      expect(requestLog[0].headers['content-type']).toBe('application/json');
    });
  });
});
