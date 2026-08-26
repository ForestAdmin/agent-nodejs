import type { Logger } from '../src/ports/logger-port';
import type { RequestListener } from 'http';
import type { AddressInfo } from 'net';

import { createServer, request as httpRequest } from 'http';
import jsonwebtoken from 'jsonwebtoken';
import request from 'supertest';

import runCli, { reportFatalError } from '../src/cli-core';
import { ConfigurationError } from '../src/errors';
import { restoreFetchAfterEach, stubEnvironmentIdFetch } from './helpers/fetch-stub';

const VALID_ENV = {
  FOREST_AUTH_SECRET: 'auth-secret',
  FOREST_ENV_SECRET: 'env-secret',
  FOREST_SERVER_URL: 'https://api.forestadmin.com',
  FOREST_APP_URL: 'https://app.forestadmin.com',
  AGENT_URL: 'https://agent.example.com',
  HTTP_PORT: '0',
} satisfies NodeJS.ProcessEnv;

const noopLogger: Logger = () => undefined;

async function countedOversizedBodyStatus(
  callback: RequestListener,
  path: string,
  token: string,
  bytes: number,
): Promise<number> {
  const server = createServer(callback);
  await new Promise<void>(resolve => {
    server.listen(0, resolve);
  });

  try {
    const { port } = server.address() as AddressInfo;

    return await new Promise<number>((resolve, reject) => {
      const outgoing = httpRequest(
        {
          port,
          path,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        },
        response => {
          response.resume();
          resolve(response.statusCode as number);
        },
      );

      outgoing.on('error', () => undefined);
      outgoing.setTimeout(10_000, () => reject(new Error('the server never answered')));
      outgoing.write(`{"messages":[{"role":"user","content":"${'x'.repeat(bytes)}"}]}`);
      outgoing.end();
    });
  } finally {
    await new Promise(resolve => {
      server.close(resolve);
    });
  }
}

function sessionToken() {
  return jsonwebtoken.sign(
    { type: 'bff_access', sid: 's1', id: 1, rendering_id: '1', tags: {} },
    VALID_ENV.FOREST_AUTH_SECRET,
    { algorithm: 'HS256', expiresIn: '15m' },
  );
}

describe('runCli', () => {
  restoreFetchAfterEach();

  describe('when a required var is absent but not malformed', () => {
    it('should still boot the server (model C, not fail-fast)', async () => {
      const server = await runCli({ ...VALID_ENV, FOREST_SERVER_URL: undefined }, noopLogger);

      try {
        expect(server).toBeDefined();
      } finally {
        await server.stop();
      }
    });
  });

  describe('when BFF_TOKEN_ENCRYPTION_KEY is absent', () => {
    it('should disable OAuth and still boot (key gates OAuth, not boot)', async () => {
      const logs: string[] = [];

      const logger: Logger = (_level, message) => {
        logs.push(message);
      };

      const server = await runCli({ ...VALID_ENV }, logger);

      try {
        expect(server).toBeDefined();
        expect(logs).toContain('OAuth routes disabled: required configuration is missing');
      } finally {
        await server.stop();
      }
    });
  });

  describe('when the full OAuth configuration is present', () => {
    const FULL_ENV = {
      ...VALID_ENV,
      BFF_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'),
    } satisfies NodeJS.ProcessEnv;

    it('should wire OAuth routes (no disabled warning) and boot', async () => {
      const fetchEnvironmentId = stubEnvironmentIdFetch();
      const logs: string[] = [];

      const logger: Logger = (_level, message) => {
        logs.push(message);
      };

      const server = await runCli({ ...FULL_ENV }, logger);

      try {
        expect(server).toBeDefined();
        expect(logs).not.toContain('OAuth routes disabled: required configuration is missing');
        expect(fetchEnvironmentId).toHaveBeenCalledTimes(1);
      } finally {
        await server.stop();
      }
    });

    it('should propagate a fetchEnvironmentId failure out of runCli', async () => {
      global.fetch = jest
        .fn()
        .mockRejectedValue(new Error('forest server unreachable')) as unknown as typeof fetch;

      await expect(runCli({ ...FULL_ENV }, noopLogger)).rejects.toThrow(
        'forest server unreachable',
      );
    });
  });

  describe('when the AI query route is mounted', () => {
    const OAUTH_ENV = {
      ...VALID_ENV,
      BFF_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'),
    } satisfies NodeJS.ProcessEnv;

    beforeEach(() => {
      stubEnvironmentIdFetch();
    });

    it('should parse a body just under 1mb and reach the route, which the 16kb global parser would have rejected', async () => {
      const server = await runCli(OAUTH_ENV, noopLogger);

      try {
        const response = await request(server.callback)
          .post('/agent/v1/ai/query')
          .set('Authorization', `Bearer ${sessionToken()}`)
          .send({ messages: [{ role: 'user', content: 'x'.repeat(900_000) }] });

        expect(response.status).not.toBe(413);
        expect(response.status).toBe(401);
        expect(response.body.error.type).toBe('session_expired');
      } finally {
        await server.stop();
      }
    });

    it('should keep the 16kb limit on a data route while the ai parser is mounted', async () => {
      const server = await runCli(OAUTH_ENV, noopLogger);

      try {
        const response = await request(server.callback)
          .post('/agent/v1/books/list')
          .set('Authorization', `Bearer ${sessionToken()}`)
          .set('X-Forest-Timezone', 'Europe/Paris')
          .send({ filler: 'x'.repeat(20_000) });

        expect(response.status).toBe(413);
      } finally {
        await server.stop();
      }
    });

    it('should leave a form body unparsed rather than let the generic parser cap it at its form limit', async () => {
      const server = await runCli(OAUTH_ENV, noopLogger);

      try {
        const response = await request(server.callback)
          .post('/agent/v1/ai/query')
          .set('Authorization', `Bearer ${sessionToken()}`)
          .type('form')
          .send(`messages=${'x'.repeat(100_000)}`);

        expect(response.status).not.toBe(413);
        expect(response.status).toBe(401);
      } finally {
        await server.stop();
      }
    });

    it('should reject a body above 1mb on its declared length, before the route is reached', async () => {
      const server = await runCli(OAUTH_ENV, noopLogger);

      try {
        const response = await request(server.callback)
          .post('/agent/v1/ai/query')
          .set('Authorization', `Bearer ${sessionToken()}`)
          .set('Content-Type', 'application/json')
          .set('Content-Length', String(2 * 1024 * 1024))
          .send('{"messages":[]}')
          .ok(() => true);

        expect(response.status).toBe(413);
      } finally {
        await server.stop();
      }
    });

    it('should reject a body just above 1mb whose bytes it had to count', async () => {
      const server = await runCli(OAUTH_ENV, noopLogger);

      try {
        const status = await countedOversizedBodyStatus(
          server.callback,
          '/agent/v1/ai/query',
          sessionToken(),
          1_050_000,
        );

        expect(status).toBe(413);
      } finally {
        await server.stop();
      }
    });

    it('should still apply the 1mb parser when the caller appends a query string', async () => {
      const server = await runCli(OAUTH_ENV, noopLogger);

      try {
        const response = await request(server.callback)
          .post('/agent/v1/ai/query?ai-name=caller-chosen')
          .set('Authorization', `Bearer ${sessionToken()}`)
          .send({ messages: [{ role: 'user', content: 'x'.repeat(900_000) }] });

        expect(response.status).not.toBe(413);
        expect(response.status).toBe(401);
      } finally {
        await server.stop();
      }
    });

    it('should reach the route without a timezone, since it is mounted before that middleware', async () => {
      const server = await runCli(OAUTH_ENV, noopLogger);

      try {
        const response = await request(server.callback)
          .post('/agent/v1/ai/query')
          .set('Authorization', `Bearer ${sessionToken()}`)
          .send({ messages: [] });

        expect(response.status).toBe(401);
        expect(response.body.error.type).toBe('session_expired');
      } finally {
        await server.stop();
      }
    });

    it('should keep parsing /oauth/token, which the scoped parser must not shadow', async () => {
      const server = await runCli(OAUTH_ENV, noopLogger);

      try {
        const response = await request(server.callback)
          .post('/oauth/token')
          .send({ grant_type: 'refresh_token' });

        expect(response.body.error).toBe('invalid_request');
      } finally {
        await server.stop();
      }
    });
  });

  describe('when FOREST_AUTH_SECRET is absent', () => {
    it('should disable the agent edge and log it', async () => {
      const logs: string[] = [];
      const logger: Logger = (_level, message) => logs.push(message);

      const server = await runCli({ ...VALID_ENV, FOREST_AUTH_SECRET: undefined }, logger);

      try {
        expect(logs).toContain('Agent edge disabled: FOREST_AUTH_SECRET is missing');
      } finally {
        await server.stop();
      }
    });
  });

  describe('when BFF_ALLOWED_ORIGINS has malformed entries', () => {
    it('should log that the malformed entries are ignored', async () => {
      const logs: string[] = [];
      const logger: Logger = (_level, message) => logs.push(message);

      const server = await runCli(
        { ...VALID_ENV, BFF_ALLOWED_ORIGINS: 'https://ok.com, garbage' },
        logger,
      );

      try {
        expect(logs).toContain('Ignoring malformed BFF_ALLOWED_ORIGINS entries');
      } finally {
        await server.stop();
      }
    });
  });

  describe('when the API key resolver is not configured', () => {
    it('should fail closed with 401 for an api-key request instead of reaching the agent stub', async () => {
      const server = await runCli({ ...VALID_ENV, FOREST_ENV_SECRET: undefined }, noopLogger);

      try {
        const response = await request(server.callback)
          .get('/agent/records')
          .set('X-Forest-Bff-Key', 'fbff_anything');

        expect(response.status).toBe(401);
        expect(response.body.error.type).toBe('unauthorized');
      } finally {
        await server.stop();
      }
    });

    it('should let an oauth Bearer request through the guard to timezone resolution', async () => {
      const token = jsonwebtoken.sign(
        { type: 'bff_access', sid: 's1', rendering_id: '1', tags: {} },
        VALID_ENV.FOREST_AUTH_SECRET,
        { algorithm: 'HS256', expiresIn: '15m' },
      );
      const server = await runCli({ ...VALID_ENV, FOREST_ENV_SECRET: undefined }, noopLogger);

      try {
        const response = await request(server.callback)
          .get('/agent/records')
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(400);
        expect(response.body.error.type).toBe('missing_timezone');
      } finally {
        await server.stop();
      }
    });

    it('should reach the context route without a timezone, since it is mounted before that middleware', async () => {
      const token = sessionToken();
      const server = await runCli(VALID_ENV, noopLogger);

      try {
        const response = await request(server.callback)
          .get('/agent/v1/context')
          .set('Authorization', `Bearer ${token}`);

        expect(response.body.error?.type).not.toBe('missing_timezone');
        expect(response.body.error).toEqual(
          expect.objectContaining({ type: 'schema_unavailable', status: 503 }),
        );
      } finally {
        await server.stop();
      }
    });

    it('should not mount the AI query route without the OAuth configuration, since it has no session', async () => {
      const token = sessionToken();
      const logs: string[] = [];
      const logger: Logger = (_level, message) => logs.push(message);
      const server = await runCli(VALID_ENV, logger);

      try {
        const response = await request(server.callback)
          .post('/agent/v1/ai/query')
          .set('Authorization', `Bearer ${token}`)
          .set('X-Forest-Timezone', 'Europe/Paris')
          .send({ messages: [] });

        expect(logs).toContain('AI query route disabled: the deployment carries no OAuth session');
        expect(response.status).toBe(404);
      } finally {
        await server.stop();
      }
    });

    it('should not mount the 1mb parser on the ai path when the route itself is absent', async () => {
      const token = sessionToken();
      const server = await runCli(VALID_ENV, noopLogger);

      try {
        const response = await request(server.callback)
          .post('/agent/v1/ai/query')
          .set('Authorization', `Bearer ${token}`)
          .set('Content-Type', 'application/json')
          .set('Content-Length', String(900_000))
          .send('{"messages":[]}')
          .ok(() => true);

        expect(response.status).toBe(413);
      } finally {
        await server.stop();
      }
    });

    it('should keep the 16kb limit on data routes, so the AI parser did not widen the whole edge', async () => {
      const token = sessionToken();
      const server = await runCli(VALID_ENV, noopLogger);

      try {
        const response = await request(server.callback)
          .post('/agent/v1/books/list')
          .set('Authorization', `Bearer ${token}`)
          .set('X-Forest-Timezone', 'Europe/Paris')
          .send({ filler: 'x'.repeat(20_000) });

        expect(response.status).toBe(413);
      } finally {
        await server.stop();
      }
    });

    it('should fall through to the agent stub when the deployment carries no read-model', async () => {
      const token = sessionToken();
      const server = await runCli({ ...VALID_ENV, FOREST_ENV_SECRET: undefined }, noopLogger);

      try {
        const withTimezone = await request(server.callback)
          .get('/agent/v1/context')
          .set('Authorization', `Bearer ${token}`)
          .set('X-Forest-Timezone', 'Europe/Paris');
        const withoutTimezone = await request(server.callback)
          .get('/agent/v1/context')
          .set('Authorization', `Bearer ${token}`);

        expect(withTimezone.status).toBe(501);
        expect(withTimezone.body.error).toEqual(
          expect.objectContaining({ type: 'not_implemented', status: 501 }),
        );
        expect(withoutTimezone.status).toBe(400);
        expect(withoutTimezone.body.error).toEqual(
          expect.objectContaining({ type: 'missing_timezone', status: 400 }),
        );
      } finally {
        await server.stop();
      }
    });

    it('should carry an oauth Bearer past requireAgentToken on a data route', async () => {
      const token = jsonwebtoken.sign(
        {
          type: 'bff_access',
          sid: 's1',
          id: 1,
          email: 'a@b.c',
          first_name: 'A',
          last_name: 'B',
          team: 'T',
          rendering_id: '1',
          permission_level: 'admin',
          tags: {},
        },
        VALID_ENV.FOREST_AUTH_SECRET,
        { algorithm: 'HS256', expiresIn: '15m' },
      );
      const server = await runCli(VALID_ENV, noopLogger);

      try {
        const response = await request(server.callback)
          .post('/agent/v1/users/list')
          .set('Authorization', `Bearer ${token}`)
          .set('X-Forest-Timezone', 'Europe/Paris')
          .send({});

        expect(response.status).toBe(503);
        expect(response.body.error).toEqual(
          expect.objectContaining({ type: 'schema_unavailable', status: 503 }),
        );
      } finally {
        await server.stop();
      }
    });
  });

  describe('when AGENT_URL is absent', () => {
    it('should still serve the permissions endpoint instead of the agent stub', async () => {
      const token = jsonwebtoken.sign(
        { type: 'bff_access', sid: 's', id: 1, rendering_id: '7' },
        VALID_ENV.FOREST_AUTH_SECRET,
        { algorithm: 'HS256', expiresIn: '15m' },
      );
      const server = await runCli({ ...VALID_ENV, AGENT_URL: undefined }, noopLogger);

      try {
        const response = await request(server.callback)
          .get('/agent/v1/permissions')
          .set('Authorization', `Bearer ${token}`)
          .set('X-Forest-Timezone', 'Europe/Paris');

        expect(response.status).not.toBe(501);
        expect(response.body.error?.type).not.toBe('not_implemented');
      } finally {
        await server.stop();
      }
    });

    it('should still stub the data routes', async () => {
      const token = jsonwebtoken.sign(
        { type: 'bff_access', sid: 's', id: 1, rendering_id: '7' },
        VALID_ENV.FOREST_AUTH_SECRET,
        { algorithm: 'HS256', expiresIn: '15m' },
      );
      const server = await runCli({ ...VALID_ENV, AGENT_URL: undefined }, noopLogger);

      try {
        const response = await request(server.callback)
          .post('/agent/v1/users/list')
          .set('Authorization', `Bearer ${token}`)
          .set('X-Forest-Timezone', 'Europe/Paris')
          .send({});

        expect(response.status).toBe(501);
        expect(response.body.error.type).toBe('not_implemented');
      } finally {
        await server.stop();
      }
    });
  });

  describe('when a request targets a non-agent path', () => {
    it('should skip the agent chain and fall through to 404', async () => {
      const server = await runCli({ ...VALID_ENV }, noopLogger);

      try {
        const response = await request(server.callback).get('/not-agent');

        expect(response.status).toBe(404);
      } finally {
        await server.stop();
      }
    });
  });

  describe('when the API documentation viewer is mounted', () => {
    it('should serve the page and its bundle without credentials, outside the agent chain', async () => {
      const server = await runCli({ ...VALID_ENV }, noopLogger);

      try {
        const page = await request(server.callback).get('/docs');
        const bundle = await request(server.callback).get('/docs/redoc.standalone.js');

        expect([page.status, bundle.status]).toEqual([200, 200]);
      } finally {
        await server.stop();
      }
    });

    it('should leave the document itself gated, since the public page must not have opened it', async () => {
      const server = await runCli({ ...VALID_ENV }, noopLogger);

      try {
        const response = await request(server.callback).get('/agent/openapi.json');

        expect(response.status).toBe(401);
      } finally {
        await server.stop();
      }
    });

    it('should serve neither route when the document is disabled', async () => {
      const server = await runCli({ ...VALID_ENV, BFF_OPENAPI_ENABLED: 'false' }, noopLogger);

      try {
        const page = await request(server.callback).get('/docs');
        const bundle = await request(server.callback).get('/docs/redoc.standalone.js');

        expect([page.status, bundle.status]).toEqual([404, 404]);
      } finally {
        await server.stop();
      }
    });

    it('should serve neither route when the agent edge is not mounted, since no document is served', async () => {
      const server = await runCli({ ...VALID_ENV, FOREST_AUTH_SECRET: undefined }, noopLogger);

      try {
        const page = await request(server.callback).get('/docs');
        const document = await request(server.callback).get('/agent/openapi.json');

        expect([page.status, document.status]).toEqual([404, 404]);
      } finally {
        await server.stop();
      }
    });
  });

  describe('when a config value is malformed', () => {
    it('should throw ConfigurationError naming the key without echoing the secret', async () => {
      const err = await runCli(
        { ...VALID_ENV, AGENT_URL: 'super-secret-bad-value' },
        noopLogger,
      ).catch((e: unknown) => e);

      expect(err).toBeInstanceOf(ConfigurationError);
      expect((err as Error).message).toBe(
        'Invalid configuration: AGENT_URL must be a valid http(s) URL.',
      );
      expect((err as Error).message).not.toContain('super-secret-bad-value');
    });
  });
});

describe('reportFatalError', () => {
  let stderrSpy: jest.SpyInstance;
  const originalExitCode = process.exitCode;

  beforeEach(() => {
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    process.exitCode = originalExitCode;
  });

  describe('when the error carries a message', () => {
    it('should set exit code 1 and write a sanitized stderr message', () => {
      reportFatalError(
        new ConfigurationError('Invalid configuration: AGENT_URL must be a valid http(s) URL.'),
      );

      expect(process.exitCode).toBe(1);
      expect(stderrSpy).toHaveBeenCalledTimes(1);
      const written = String(stderrSpy.mock.calls[0][0]);
      expect(written).toContain('Error: Invalid configuration: AGENT_URL');
      expect(written).not.toContain('super-secret-bad-value');
    });
  });

  describe('when the error message is empty (wrapped infra error)', () => {
    it('should fall back to the error name', () => {
      const wrapped = new Error('');
      wrapped.name = 'SequelizeConnectionRefusedError';
      reportFatalError(wrapped);

      const written = String(stderrSpy.mock.calls[0][0]);
      expect(written).toBe('Error: SequelizeConnectionRefusedError\n');
    });
  });
});
