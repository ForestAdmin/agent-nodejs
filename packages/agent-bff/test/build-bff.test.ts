import type { Logger } from '../src/ports/logger-port';

import request from 'supertest';

import { createHttpTransport } from '../src/agent/agent-transport';
import buildBff from '../src/build-bff';
import { parseConfig } from '../src/config/env-config';
import version from '../src/version';
import { restoreFetchAfterEach, stubEnvironmentIdFetch } from './helpers/fetch-stub';

jest.mock('../src/agent/agent-transport', () => {
  const actual = jest.requireActual('../src/agent/agent-transport');

  return { ...actual, createHttpTransport: jest.fn(actual.createHttpTransport) };
});

const VALID_ENV = {
  FOREST_AUTH_SECRET: 'auth-secret',
  FOREST_ENV_SECRET: 'env-secret',
  FOREST_SERVER_URL: 'https://api.forestadmin.com',
  FOREST_APP_URL: 'https://app.forestadmin.com',
  AGENT_URL: 'https://agent.example.com',
  BFF_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'),
} satisfies NodeJS.ProcessEnv;

const noopLogger: Logger = () => undefined;

async function buildCallback(env: NodeJS.ProcessEnv) {
  const { callback } = await buildBff({ config: parseConfig(env), logger: noopLogger });

  return callback;
}

describe('buildBff', () => {
  restoreFetchAfterEach();

  beforeEach(() => {
    jest.mocked(createHttpTransport).mockClear();
    stubEnvironmentIdFetch();
  });

  it('should cap every transport it builds with the configured BFF_AGENT_TIMEOUT_MS', async () => {
    await buildBff({
      config: parseConfig({ ...VALID_ENV, BFF_AGENT_TIMEOUT_MS: '2500' }),
      logger: noopLogger,
    });

    const built = jest.mocked(createHttpTransport).mock.calls.map(([options]) => options);
    const capped = { agentUrl: VALID_ENV.AGENT_URL, timeoutMs: 2500 };

    expect(built).not.toHaveLength(0);
    expect(built).toEqual(built.map(() => capped));
  });

  describe('when every required key is present', () => {
    it('should answer /health with ok and the version', async () => {
      const callback = await buildCallback(VALID_ENV);

      const response = await request(callback).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok', version });
    });

    it('should set the version header on /health, which only holds if it is mounted first', async () => {
      const callback = await buildCallback(VALID_ENV);

      const response = await request(callback).get('/health');

      expect(response.headers['x-forest-bff-version']).toBe(version);
    });
  });

  describe('when a required key is missing', () => {
    it('should answer /health with degraded', async () => {
      const callback = await buildCallback({ ...VALID_ENV, FOREST_SERVER_URL: undefined });

      const response = await request(callback).get('/health');

      expect(response.status).toBe(503);
      expect(response.body).toEqual({ status: 'degraded', version });
    });

    it('should warn naming the missing keys', async () => {
      const logger = jest.fn();

      await buildBff({ config: parseConfig({ ...VALID_ENV, AGENT_URL: undefined }), logger });

      expect(logger).toHaveBeenCalledWith(
        'Warn',
        'Missing required configuration; /health will report degraded',
        { missing: ['AGENT_URL'] },
      );
    });
  });

  it('should set the version header on every response', async () => {
    const callback = await buildCallback(VALID_ENV);

    const response = await request(callback).get('/unknown-path');

    expect(response.headers['x-forest-bff-version']).toBe(version);
  });

  it('should answer 401 on an unauthenticated agent route', async () => {
    const callback = await buildCallback(VALID_ENV);

    const response = await request(callback).post('/agent/v1/companies/list').send({});

    expect(response.status).toBe(401);
  });

  describe('when the host serves the BFF under a prefix', () => {
    it('should point the docs page at the prefixed document and bundle', async () => {
      const { callback } = await buildBff({
        config: parseConfig(VALID_ENV),
        logger: noopLogger,
        basePath: '/bff',
      });

      const response = await request(callback).get('/docs');

      expect(response.status).toBe(200);
      expect(response.text).toContain('/bff/agent/openapi.json');
      expect(response.text).toContain('/bff/docs/redoc.standalone.js');
    });

    it('should leave the routes themselves unprefixed, since the host strips before dispatching', async () => {
      const { callback } = await buildBff({
        config: parseConfig(VALID_ENV),
        logger: noopLogger,
        basePath: '/bff',
      });

      const response = await request(callback).get('/health');

      expect(response.status).toBe(200);
    });
  });

  describe('when the BFF owns the origin root', () => {
    it('should emit unprefixed asset paths', async () => {
      const callback = await buildCallback(VALID_ENV);

      const response = await request(callback).get('/docs');

      expect(response.text).toContain('"/agent/openapi.json"');
      expect(response.text).toContain('src="/docs/redoc.standalone.js"');
    });
  });

  describe('when BFF_ALLOWED_ORIGINS carries a malformed entry', () => {
    it('should warn once with the rejected entries', async () => {
      const logger = jest.fn();

      await buildBff({
        config: parseConfig({ ...VALID_ENV, BFF_ALLOWED_ORIGINS: 'https://ok.example.com,*' }),
        logger,
      });

      expect(logger).toHaveBeenCalledWith(
        'Warn',
        'Ignoring malformed BFF_ALLOWED_ORIGINS entries',
        { entries: ['*'] },
      );
    });
  });
});
