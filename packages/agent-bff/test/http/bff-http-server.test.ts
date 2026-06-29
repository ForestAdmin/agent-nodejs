import type { Server } from 'http';

import http from 'http';
import request from 'supertest';

import { parseConfig } from '../../src/config/env-config';
import BFFHttpServer from '../../src/http/bff-http-server';

const VERSION = '9.9.9';

const VALID_ENV = {
  FOREST_AUTH_SECRET: 'auth-secret',
  FOREST_ENV_SECRET: 'env-secret',
  FOREST_SERVER_URL: 'https://api.forestadmin.com',
  FOREST_APP_URL: 'https://app.forestadmin.com',
  AGENT_URL: 'https://agent.example.com',
} satisfies NodeJS.ProcessEnv;

const noopLogger = () => undefined;

function createServer(env: NodeJS.ProcessEnv, port = 0) {
  const config = parseConfig(env);

  return new BFFHttpServer({ port, version: VERSION, config, logger: noopLogger });
}

function listenOnEphemeralPort(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    let onError: (error: Error) => void;

    const onListening = () => {
      server.removeListener('error', onError);
      const address = server.address();

      if (typeof address !== 'object' || !address) {
        reject(new Error('Expected occupied port'));

        return;
      }

      resolve(address.port);
    };

    onError = (error: Error) => {
      server.removeListener('listening', onListening);
      reject(error);
    };

    server.once('error', onError);
    server.listen(0, onListening);
  });
}

function closeServer(server: Server): Promise<void> {
  if (!server.listening) return Promise.resolve();

  return new Promise((resolve, reject) => {
    server.close(error => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

describe('BFFHttpServer', () => {
  describe('when config is complete', () => {
    it('should answer GET /health with 200 ok and the version only', async () => {
      const server = createServer({ ...VALID_ENV });

      const response = await request(server.callback).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok', version: VERSION });
    });

    it('should never expose config presence or secret values in the response body', async () => {
      const server = createServer({ ...VALID_ENV });

      const response = await request(server.callback).get('/health');

      const body = JSON.stringify(response.body);
      expect(body).not.toContain('auth-secret');
      expect(body).not.toContain('env-secret');
      expect(response.body.config).toBeUndefined();
      expect(body).not.toContain('FOREST_AUTH_SECRET');
    });

    it('should answer HEAD /health with 200 (infra probes), not just GET', async () => {
      const server = createServer({ ...VALID_ENV });

      const response = await request(server.callback).head('/health');

      expect(response.status).toBe(200);
    });
  });

  describe('when a required var is missing', () => {
    it('should answer GET /health with 503 degraded without disclosing which key is missing', async () => {
      const server = createServer({ ...VALID_ENV, FOREST_SERVER_URL: undefined });

      const response = await request(server.callback).get('/health');

      expect(response.status).toBe(503);
      expect(response.body).toEqual({ status: 'degraded', version: VERSION });
    });

    it('should answer HEAD /health with 503', async () => {
      const server = createServer({ ...VALID_ENV, FOREST_SERVER_URL: undefined });

      const response = await request(server.callback).head('/health');

      expect(response.status).toBe(503);
    });

    it('should warn at startup listing the missing keys', async () => {
      const logger = jest.fn();
      const config = parseConfig({ ...VALID_ENV, AGENT_URL: undefined });
      const server = new BFFHttpServer({ port: 0, version: VERSION, config, logger });

      try {
        await server.start();
      } finally {
        await server.stop();
      }

      expect(logger).toHaveBeenCalledWith(
        'Warn',
        'Missing required configuration; /health will report degraded',
        { missing: ['AGENT_URL'] },
      );
    });
  });

  describe('when any route is requested', () => {
    it('should set X-Forest-Bff-Version on a non-health (404) route', async () => {
      const server = createServer({ ...VALID_ENV });

      const response = await request(server.callback).get('/does-not-exist');

      expect(response.status).toBe(404);
      expect(response.headers['x-forest-bff-version']).toBe(VERSION);
    });
  });

  describe('when start is called twice', () => {
    it('should throw instead of orphaning the first server', async () => {
      const server = createServer({ ...VALID_ENV });
      await server.start();

      try {
        await expect(server.start()).rejects.toThrow('Server already started');
      } finally {
        await server.stop();
      }
    });
  });

  describe('when start fails before binding', () => {
    it('should allow a later retry after the port becomes available', async () => {
      const occupied = http.createServer();
      const occupiedPort = await listenOnEphemeralPort(occupied);
      const server = createServer({ ...VALID_ENV }, occupiedPort);

      try {
        await expect(server.start()).rejects.toMatchObject({ code: 'EADDRINUSE' });
        await closeServer(occupied);

        await expect(server.start()).resolves.toBeUndefined();
      } finally {
        await closeServer(occupied);
        await server.stop();
      }
    });
  });

  describe('when stop is called without a running server', () => {
    it('should resolve immediately', async () => {
      const server = createServer({ ...VALID_ENV });

      await expect(server.stop()).resolves.toBeUndefined();
    });
  });

  describe('when the underlying server fails to close', () => {
    it('should reject with the close error', async () => {
      const server = createServer({ ...VALID_ENV });
      await server.start();

      const closeError = new Error('close failed');
      const internal = (server as unknown as { server: Server }).server;
      jest.spyOn(internal, 'close').mockImplementation(((cb: (err?: Error) => void) => {
        cb(closeError);

        return internal;
      }) as Server['close']);

      await expect(server.stop()).rejects.toBe(closeError);

      jest.restoreAllMocks();
      await closeServer(internal);
    });
  });
});
