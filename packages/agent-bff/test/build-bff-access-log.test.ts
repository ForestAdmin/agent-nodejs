import type { Logger, LoggerLevel } from '../src/ports/logger-port';

import request from 'supertest';

import buildBff from '../src/build-bff';
import { restoreFetchAfterEach, stubEnvironmentIdFetch } from './helpers/fetch-stub';
import { parseConfig } from '../src/config/env-config';

const VALID_ENV = {
  FOREST_AUTH_SECRET: 'auth-secret',
  FOREST_ENV_SECRET: 'env-secret',
  FOREST_SERVER_URL: 'https://api.forestadmin.com',
  FOREST_APP_URL: 'https://app.forestadmin.com',
  AGENT_URL: 'https://agent.example.com',
  BFF_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'),
  BFF_ALLOWED_ORIGINS: 'https://allowed.example.com',
} satisfies NodeJS.ProcessEnv;

type Line = [LoggerLevel, string];

async function buildWithSpy(basePath?: string) {
  const lines: Line[] = [];
  const logger: Logger = (level, message) => lines.push([level, message]);
  const { callback } = await buildBff({ config: parseConfig(VALID_ENV), logger, basePath });

  lines.length = 0;

  return { callback, lines };
}

function accessLines(lines: Line[]): Line[] {
  return lines.filter(([, message]) => /^\[\d{3}\] /.test(message));
}

describe('buildBff access log', () => {
  restoreFetchAfterEach();

  beforeEach(() => {
    stubEnvironmentIdFetch();
  });

  it('logs /health, which no other layer ever sees', async () => {
    const { callback, lines } = await buildWithSpy();

    await request(callback).get('/health');

    expect(accessLines(lines)).toEqual([
      ['Info', expect.stringMatching(/^\[200\] GET \/health - \d+ms$/)],
    ]);
  });

  it('logs an origin rejected by CORS, which never reaches the agent edge', async () => {
    const { callback, lines } = await buildWithSpy();

    const res = await request(callback)
      .get('/agent/v1/collections/companies')
      .set('Origin', 'https://evil.example.com');

    expect(res.status).toBe(403);
    expect(accessLines(lines)).toEqual([
      ['Warn', expect.stringMatching(/^\[403\] GET \/agent\/v1\/collections\/companies - \d+ms$/)],
    ]);
  });

  it('logs a request rejected by the auth edge', async () => {
    const { callback, lines } = await buildWithSpy();

    const res = await request(callback).get('/agent/v1/collections/companies');

    expect(res.status).toBe(401);
    expect(accessLines(lines)).toEqual([
      ['Warn', expect.stringMatching(/^\[401\] GET \/agent\/v1\/collections\/companies - \d+ms$/)],
    ]);
  });

  it('logs a path no route claims', async () => {
    const { callback, lines } = await buildWithSpy();

    const res = await request(callback).get('/nowhere');

    expect(res.status).toBe(404);
    expect(accessLines(lines)).toEqual([
      ['Warn', expect.stringMatching(/^\[404\] GET \/nowhere - \d+ms$/)],
    ]);
  });

  it('names the mounted path an embedded caller asked for', async () => {
    const { callback, lines } = await buildWithSpy('/bff');

    await request(callback).get('/health');

    expect(accessLines(lines)[0][1]).toMatch(/^\[200\] GET \/bff\/health - \d+ms$/);
  });
});
