import type { ApiKeyAuthenticator } from '../../src/api-key/api-key-authenticator';
import type { LoggerLevel } from '../../src/ports/logger-port';

import Koa from 'koa';
import request from 'supertest';

import { invalidApiKey, keyResolutionUnavailable } from '../../src/api-key/api-key-error';
import createApiKeyMiddleware, { BFF_KEY_HEADER } from '../../src/api-key/api-key-middleware';
import createErrorMiddleware from '../../src/http/error-middleware';

const KEY_ID = 'a'.repeat(16);
const SECRET = 'b'.repeat(64);
const RAW = `fbff_${KEY_ID}_${SECRET}`;

const IDENTITY = {
  user: {
    id: 42,
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    team: 'Support',
    tags: [{ key: 'region', value: 'eu' }],
    permissionLevel: 'admin',
  },
  renderingId: 17,
  allowedOrigins: ['https://app.example.com'],
};

interface LogLine {
  level: LoggerLevel;
  message: string;
  context?: Record<string, unknown>;
}

function buildApp(authenticate: ApiKeyAuthenticator['authenticate']) {
  const logs: LogLine[] = [];

  const logger = (level: LoggerLevel, message: string, context?: Record<string, unknown>) => {
    logs.push({ level, message, context });
  };

  const app = new Koa();
  app.silent = true;
  app.use(createErrorMiddleware({ logger }));
  app.use(createApiKeyMiddleware({ authenticator: { authenticate }, logger }));
  app.use(async ctx => {
    ctx.status = 200;
    ctx.body = {
      agentToken: ctx.state.agentToken ?? null,
      identity: ctx.state.apiKeyIdentity ?? null,
    };
  });

  return { app, logs };
}

describe('api key middleware', () => {
  describe('when the key resolves', () => {
    it('should attach the minted token and identity to ctx.state with no-store', async () => {
      const authenticate = jest.fn(async () => ({
        agentToken: 'minted-token',
        identity: IDENTITY,
      }));
      const { app } = buildApp(authenticate);

      const response = await request(app.callback()).get('/').set(BFF_KEY_HEADER, RAW);

      expect(authenticate).toHaveBeenCalledWith(RAW);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ agentToken: 'minted-token', identity: IDENTITY });
      expect(response.headers['cache-control']).toBe('no-store');
    });

    it('should log the rendering id and a key fingerprint, never the raw secret', async () => {
      const authenticate = jest.fn(async () => ({
        agentToken: 'minted-token',
        identity: IDENTITY,
      }));
      const { app, logs } = buildApp(authenticate);

      await request(app.callback()).get('/').set(BFF_KEY_HEADER, RAW);

      expect(logs).toContainEqual(
        expect.objectContaining({
          level: 'Info',
          context: expect.objectContaining({ renderingId: 17 }),
        }),
      );
      expect(JSON.stringify(logs)).not.toContain(SECRET);
    });
  });

  describe('when the authenticator rejects', () => {
    it('should surface 401 invalid_api_key in the nested error shape', async () => {
      const authenticate = jest.fn(async () => {
        throw invalidApiKey();
      });
      const { app } = buildApp(authenticate);

      const response = await request(app.callback()).get('/').set(BFF_KEY_HEADER, 'bad-key');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: { type: 'invalid_api_key', status: 401, message: 'Invalid API key' },
      });
    });

    it('should set Retry-After on a 503 key_resolution_unavailable', async () => {
      const authenticate = jest.fn(async () => {
        throw keyResolutionUnavailable(5);
      });
      const { app } = buildApp(authenticate);

      const response = await request(app.callback()).get('/').set(BFF_KEY_HEADER, RAW);

      expect(response.status).toBe(503);
      expect(response.body.error.type).toBe('key_resolution_unavailable');
      expect(response.headers['retry-after']).toBe('5');
    });

    it('should log a fingerprinted rejection without the raw secret', async () => {
      const authenticate = jest.fn(async () => {
        throw invalidApiKey();
      });
      const { app, logs } = buildApp(authenticate);

      await request(app.callback()).get('/').set(BFF_KEY_HEADER, RAW);

      expect(logs).toContainEqual(
        expect.objectContaining({ level: 'Warn', message: 'BFF API key rejected' }),
      );
      expect(JSON.stringify(logs)).not.toContain(SECRET);
    });
  });

  describe('when the authenticator throws an unexpected error', () => {
    it('should surface a 500 internal_error and log the failure without the raw secret', async () => {
      const authenticate = jest.fn(async () => {
        throw new Error('unexpected boom');
      });
      const { app, logs } = buildApp(authenticate);

      const response = await request(app.callback()).get('/').set(BFF_KEY_HEADER, RAW);

      expect(response.status).toBe(500);
      expect(response.body.error.type).toBe('internal_error');
      expect(logs).toContainEqual(
        expect.objectContaining({ level: 'Error', message: 'BFF API key middleware failure' }),
      );
      expect(JSON.stringify(logs)).not.toContain(SECRET);
    });
  });

  describe('when a downstream handler throws after the key is accepted', () => {
    it('should not report it as an API key failure', async () => {
      const authenticate = jest.fn(async () => ({
        agentToken: 'minted-token',
        identity: IDENTITY,
      }));
      const logs: LogLine[] = [];

      const logger = (level: LoggerLevel, message: string, context?: Record<string, unknown>) => {
        logs.push({ level, message, context });
      };

      const app = new Koa();
      app.silent = true;
      app.use(createErrorMiddleware({ logger }));
      app.use(createApiKeyMiddleware({ authenticator: { authenticate }, logger }));
      app.use(async () => {
        throw new Error('downstream boom');
      });

      const response = await request(app.callback()).get('/').set(BFF_KEY_HEADER, RAW);

      expect(response.status).toBe(500);
      expect(logs).not.toContainEqual(
        expect.objectContaining({ message: 'BFF API key middleware failure' }),
      );
    });
  });

  describe('when no key header is present', () => {
    it('should pass through to the next middleware without authenticating', async () => {
      const authenticate = jest.fn();
      const { app } = buildApp(authenticate);

      const response = await request(app.callback()).get('/');

      expect(authenticate).not.toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ agentToken: null, identity: null });
    });
  });
});
