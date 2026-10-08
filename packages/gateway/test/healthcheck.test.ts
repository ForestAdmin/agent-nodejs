import type { AddressInfo } from 'net';

import http from 'http';

import probeHealth from '../src/healthcheck';

async function serve(
  status: number,
): Promise<{ server: http.Server; port: number; paths: string[] }> {
  const paths: string[] = [];
  const server = http.createServer((req, res) => {
    paths.push(req.url ?? '');
    res.statusCode = status;
    res.end();
  });

  await new Promise<void>(resolve => {
    server.listen(0, resolve);
  });

  return { server, port: (server.address() as AddressInfo).port, paths };
}

function close(server: http.Server): Promise<void> {
  return new Promise(resolve => {
    server.close(() => resolve());
  });
}

describe('probeHealth', () => {
  it('should pass when /health on PORT answers 200', async () => {
    const { server, port, paths } = await serve(200);

    try {
      await expect(
        probeHealth({ FOREST_GATEWAY_SERVICES: 'mcp,api', PORT: String(port) }),
      ).resolves.toBeUndefined();
      expect(paths).toEqual(['/health']);
    } finally {
      await close(server);
    }
  });

  it('should probe the port a legacy alias names', async () => {
    const { server, port } = await serve(200);

    try {
      await expect(
        probeHealth({ FOREST_GATEWAY_SERVICES: 'api', HTTP_PORT: String(port) }),
      ).resolves.toBeUndefined();
    } finally {
      await close(server);
    }
  });

  it('should fail when /health answers 503', async () => {
    const { server, port } = await serve(503);

    try {
      await expect(
        probeHealth({ FOREST_GATEWAY_SERVICES: 'mcp', PORT: String(port) }),
      ).resolves.toBe(`/health on port ${port} answered 503`);
    } finally {
      await close(server);
    }
  });

  it('should fail when nothing listens on the port', async () => {
    const { server, port } = await serve(200);
    await close(server);

    await expect(
      probeHealth({ FOREST_GATEWAY_SERVICES: 'mcp', PORT: String(port) }),
    ).resolves.toMatch(new RegExp(`^/health on port ${port}: ECONNREFUSED$`));
  });

  it('should fail when /health does not answer within the timeout', async () => {
    const server = http.createServer(() => undefined);
    await new Promise<void>(resolve => {
      server.listen(0, resolve);
    });
    const { port } = server.address() as AddressInfo;

    try {
      await expect(
        probeHealth({ FOREST_GATEWAY_SERVICES: 'mcp', PORT: String(port) }, 50),
      ).resolves.toBe(`/health on port ${port}: timed out after 50ms`);
    } finally {
      server.closeAllConnections();
      await close(server);
    }
  });

  it('should fail naming the variable when the services are invalid', async () => {
    await expect(probeHealth({ FOREST_GATEWAY_SERVICES: 'foo' })).resolves.toMatch(
      /^Invalid FOREST_GATEWAY_SERVICES "foo"/,
    );
  });

  it('should fail naming the variable when the port is invalid', async () => {
    await expect(probeHealth({ FOREST_GATEWAY_SERVICES: 'mcp', PORT: 'abc' })).resolves.toBe(
      'Invalid PORT "abc": expected an integer between 0 and 65535.',
    );
  });

  it('should fail on PORT=0, which cannot be probed', async () => {
    await expect(probeHealth({ FOREST_GATEWAY_SERVICES: 'mcp', PORT: '0' })).resolves.toBe(
      'PORT=0 binds a port chosen by the OS, which cannot be probed',
    );
  });
});
