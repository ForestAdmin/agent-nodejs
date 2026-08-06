import type { Logger } from '../../src/ports/logger-port';

import request from 'supertest';

import runCli from '../../src/cli-core';
import { issueBffAccessToken } from '../../src/oauth/bff-token';
import { OPENAPI_PATH } from '../../src/openapi/openapi-routes';

const VALID_ENV = {
  FOREST_AUTH_SECRET: 'auth-secret',
  FOREST_ENV_SECRET: 'env-secret',
  FOREST_SERVER_URL: 'https://api.forestadmin.com',
  FOREST_APP_URL: 'https://app.forestadmin.com',
  AGENT_URL: 'https://agent.example.com',
  HTTP_PORT: '0',
} satisfies NodeJS.ProcessEnv;

const noopLogger: Logger = () => undefined;

function sessionToken(): string {
  return issueBffAccessToken({
    sid: 'session-1',
    user: {
      id: 1,
      email: 'user@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      team: 'Operations',
      permissionLevel: 'admin',
      role: 'admin',
      tags: {},
      renderingId: 1,
    },
    renderingId: 1,
    authSecret: VALID_ENV.FOREST_AUTH_SECRET,
    expiresInSeconds: 900,
  });
}

async function withServer(
  env: NodeJS.ProcessEnv,
  run: (server: Awaited<ReturnType<typeof runCli>>) => Promise<void>,
): Promise<void> {
  const server = await runCli(env, noopLogger);

  try {
    await run(server);
  } finally {
    await server.stop();
  }
}

describe('GET /agent/openapi.json', () => {
  describe('when no credentials are sent', () => {
    it('should return 401 and never the document, since the route sits behind the agent gate', async () => {
      await withServer(VALID_ENV, async server => {
        const response = await request(server.callback).get(OPENAPI_PATH);

        expect(response.status).toBe(401);
        expect(response.body).toEqual({
          error: expect.objectContaining({ type: 'unauthorized', status: 401 }),
        });
        expect(response.text).not.toContain('openapi');
      });
    });
  });

  describe('when a valid session token is sent', () => {
    it('should serve the OpenAPI document', async () => {
      await withServer(VALID_ENV, async server => {
        const response = await request(server.callback)
          .get(OPENAPI_PATH)
          .set('Authorization', `Bearer ${sessionToken()}`);

        expect(response.status).toBe(200);
        expect(response.body.openapi).toBe('3.1.0');
        expect(Object.keys(response.body.paths)).toHaveLength(6);
      });
    });
  });

  describe('when the document is requested at the root instead of under /agent', () => {
    it('should return 404, since only the /agent path is mounted', async () => {
      await withServer(VALID_ENV, async server => {
        const response = await request(server.callback).get('/openapi.json');

        expect(response.status).toBe(404);
        expect(response.text).not.toContain('openapi');
      });
    });
  });

  describe('when the agent url is absent, so data endpoints fall back to the stub', () => {
    it('should still serve the document, since it never calls the agent', async () => {
      await withServer({ ...VALID_ENV, AGENT_URL: undefined }, async server => {
        const response = await request(server.callback)
          .get(OPENAPI_PATH)
          .set('Authorization', `Bearer ${sessionToken()}`);

        expect(response.status).toBe(200);
        expect(response.body.openapi).toBe('3.1.0');
      });
    });
  });

  describe('when the auth secret is absent, so the whole agent edge is disabled', () => {
    it('should not serve the document, since an ungated document leaks the API surface', async () => {
      await withServer({ ...VALID_ENV, FOREST_AUTH_SECRET: undefined }, async server => {
        const response = await request(server.callback).get(OPENAPI_PATH);

        expect(response.status).toBe(404);
        expect(response.text).not.toContain('"openapi"');
      });
    });
  });

  describe('when the document is requested twice', () => {
    it('should return the byte-identical document, since it is built once at boot', async () => {
      await withServer(VALID_ENV, async server => {
        const token = sessionToken();
        const first = await request(server.callback)
          .get(OPENAPI_PATH)
          .set('Authorization', `Bearer ${token}`);
        const second = await request(server.callback)
          .get(OPENAPI_PATH)
          .set('Authorization', `Bearer ${token}`);

        expect(first.text).toBe(second.text);
      });
    });
  });

  describe('when the path is written as a variant of the canonical one', () => {
    it.each([
      ['a trailing slash', '/agent/openapi.json/'],
      ['a different case', '/agent/OpenAPI.json'],
      ['a percent-encoded letter', '/agent/%6fpenapi.json'],
      ['a dot segment', '/agent/./openapi.json'],
      ['a parent-dir segment', '/agent/x/../openapi.json'],
      ['a doubled leading slash', '//agent/openapi.json'],
    ])('should not serve the document to an unauthenticated caller using %s', async (_, path) => {
      await withServer(VALID_ENV, async server => {
        const response = await request(server.callback).get(path);

        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.text).not.toContain('"openapi"');
      });
    });
  });

  describe('when an authenticated caller uses a non-canonical path', () => {
    it('should serve the document only on the exact path', async () => {
      await withServer(VALID_ENV, async server => {
        const authorized = request(server.callback)
          .get('/agent/openapi.json/')
          .set('Authorization', `Bearer ${sessionToken()}`);

        expect((await authorized).text).not.toContain('"openapi"');
      });
    });
  });

  describe('when the document is requested with HEAD', () => {
    it('should answer 200 without a body, since HEAD carries no payload', async () => {
      await withServer(VALID_ENV, async server => {
        const response = await request(server.callback)
          .head(OPENAPI_PATH)
          .set('Authorization', `Bearer ${sessionToken()}`);

        expect(response.status).toBe(200);
        expect(response.text).toBeUndefined();
      });
    });
  });

  describe('when a method other than GET or HEAD is used', () => {
    it('should fall through without serving the document', async () => {
      await withServer(VALID_ENV, async server => {
        const response = await request(server.callback)
          .post(OPENAPI_PATH)
          .set('Authorization', `Bearer ${sessionToken()}`)
          .send({});

        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.text).not.toContain('"openapi"');
      });
    });
  });
});
