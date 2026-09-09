import type { Logger } from '../src/ports/logger-port';

import request from 'supertest';

import buildBff from '../src/build-bff';
import { parseConfig } from '../src/config/env-config';
import version from '../src/version';
import { restoreFetchAfterEach, stubEnvironmentIdFetch } from './helpers/fetch-stub';

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
    stubEnvironmentIdFetch();
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
