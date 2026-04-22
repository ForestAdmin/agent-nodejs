import http from 'http';

import { createRemoteAgentClient } from '../../src/index';

// End-to-end wire check — spins up a real HTTP server and asserts that composite PKs
// passed as arrays (e.g. [1, 'abc']) arrive at the agent as pipe-joined ids. On the wire
// the pipe is %7C-encoded by HttpRequester.escapeUrlSlug (standard HTTP URL encoding),
// which is identical to how scalar callers passing "1|abc" as a string have always been
// encoded — so this PR changes nothing in what the backend receives. decodeURIComponent
// on the received path yields the same "1|abc" the agent has always decoded.
describe('Composite primary keys (integration)', () => {
  let server: http.Server;
  let serverPort: number;
  let requestLog: Array<{
    method: string;
    pathname: string;
    rawUrl: string;
    body: string;
  }>;

  beforeAll(() => {
    requestLog = [];

    server = http.createServer((req, res) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
      });

      req.on('end', () => {
        const parsed = new URL(req.url!, `http://localhost:${serverPort}`);
        requestLog.push({
          method: req.method!,
          pathname: parsed.pathname,
          rawUrl: req.url!,
          body,
        });

        res.setHeader('Content-Type', 'application/json');

        if (req.method === 'PUT') {
          const parsedBody = JSON.parse(body);
          res.statusCode = 200;
          res.end(
            JSON.stringify({
              data: {
                id: parsedBody.data.id,
                type: 'record',
                attributes: { ...parsedBody.data.attributes, id: parsedBody.data.id },
              },
            }),
          );

          return;
        }

        if (req.method === 'DELETE') {
          res.statusCode = 204;
          res.end();

          return;
        }

        if (req.method === 'GET') {
          res.statusCode = 200;
          res.end(JSON.stringify({ data: [] }));

          return;
        }

        if (req.method === 'POST') {
          res.statusCode = 200;
          res.end(JSON.stringify({ data: null }));

          return;
        }

        res.statusCode = 404;
        res.end();
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

  it('update should send "1|abc" in both URL path and body', async () => {
    const client = createRemoteAgentClient({
      url: `http://localhost:${serverPort}`,
      token: 'test-token',
    });

    await client.collection('users').update([1, 'abc'], { name: 'John' });

    expect(requestLog).toHaveLength(1);
    expect(requestLog[0].method).toBe('PUT');
    // The wire URL is %7C-encoded (standard HTTP); decoding yields the pipe-joined id.
    expect(requestLog[0].rawUrl).toContain('1%7Cabc');
    expect(decodeURIComponent(requestLog[0].pathname)).toBe('/forest/users/1|abc');

    const parsedBody = JSON.parse(requestLog[0].body);
    expect(parsedBody.data.id).toBe('1|abc');
  });

  it('delete should send composite ids as "k1|k2" strings in the body', async () => {
    const client = createRemoteAgentClient({
      url: `http://localhost:${serverPort}`,
      token: 'test-token',
    });

    await client.collection('users').delete([
      [1, 'abc'],
      [2, 'def'],
    ]);

    expect(requestLog).toHaveLength(1);
    expect(requestLog[0].method).toBe('DELETE');

    const parsedBody = JSON.parse(requestLog[0].body);
    expect(parsedBody.data.attributes.ids).toEqual(['1|abc', '2|def']);
  });

  it('relation.list should send "1|abc" as parent id in the URL path', async () => {
    const client = createRemoteAgentClient({
      url: `http://localhost:${serverPort}`,
      token: 'test-token',
    });

    await client.collection('users').relation('posts', [1, 'abc']).list();

    expect(requestLog).toHaveLength(1);
    expect(requestLog[0].method).toBe('GET');
    expect(requestLog[0].rawUrl).toContain('1%7Cabc');
    expect(decodeURIComponent(requestLog[0].pathname)).toBe(
      '/forest/users/1|abc/relationships/posts',
    );
  });

  it('associate should send composite parent id in path and composite target id in body', async () => {
    const client = createRemoteAgentClient({
      url: `http://localhost:${serverPort}`,
      token: 'test-token',
    });

    await client.collection('users').relation('tags', [1, 'abc']).associate([42, 'x']);

    expect(requestLog).toHaveLength(1);
    expect(requestLog[0].method).toBe('POST');
    expect(decodeURIComponent(requestLog[0].pathname)).toBe(
      '/forest/users/1|abc/relationships/tags',
    );

    const parsedBody = JSON.parse(requestLog[0].body);
    expect(parsedBody.data).toEqual([{ id: '42|x', type: 'tags' }]);
  });

  it('dissociate should send composite target ids as pipe-joined strings', async () => {
    const client = createRemoteAgentClient({
      url: `http://localhost:${serverPort}`,
      token: 'test-token',
    });

    await client
      .collection('users')
      .relation('tags', [1, 'abc'])
      .dissociate([
        [42, 'x'],
        [43, 'y'],
      ]);

    expect(requestLog).toHaveLength(1);
    expect(requestLog[0].method).toBe('DELETE');
    expect(decodeURIComponent(requestLog[0].pathname)).toBe(
      '/forest/users/1|abc/relationships/tags',
    );

    const parsedBody = JSON.parse(requestLog[0].body);
    expect(parsedBody.data.attributes.ids).toEqual(['42|x', '43|y']);
  });

  it('should produce the same wire format as a legacy pipe-encoded string caller', async () => {
    // Regression guard: passing a composite array must produce the exact same HTTP
    // request as passing the already pipe-encoded string "1|abc". This proves the
    // refactor is wire-compatible and the backend cannot distinguish the two.
    const client = createRemoteAgentClient({
      url: `http://localhost:${serverPort}`,
      token: 'test-token',
    });

    await client.collection('users').update([1, 'abc'], { name: 'John' });
    await client.collection('users').update('1|abc', { name: 'John' });

    expect(requestLog).toHaveLength(2);
    expect(requestLog[0].method).toBe(requestLog[1].method);
    expect(requestLog[0].rawUrl).toBe(requestLog[1].rawUrl);
    expect(requestLog[0].body).toBe(requestLog[1].body);
  });
});
