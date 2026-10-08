import type { AddressInfo } from 'net';

import http from 'http';

const ROUTES: Record<string, unknown> = {
  '/liana/environment': {
    data: { id: '12345', attributes: { api_endpoint: 'https://api.example.com' } },
  },
  '/liana/forest-schema': {
    data: [],
    meta: { liana: 'forest-express-sequelize', liana_version: '9.0.0', liana_features: null },
  },
};

export interface FakeForestServer {
  url: string;
  close: () => Promise<void>;
}

export default async function startFakeForestServer(): Promise<FakeForestServer> {
  const server = http.createServer((req, res) => {
    const [pathname] = (req.url ?? '/').split('?', 1);
    const body = ROUTES[pathname];

    res.setHeader('Content-Type', 'application/json');
    res.statusCode = body ? 200 : 404;
    res.end(JSON.stringify(body ?? { error: 'Not found' }));
  });

  await new Promise<void>(resolve => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise(resolve => {
        server.close(() => resolve());
      }),
  };
}
