import type { Logger } from '../../src/ports/logger-port';
import type ReadModelStore from '../../src/read-model/read-model-store';
import type { Middleware } from 'koa';

import request from 'supertest';

import runCli from '../../src/cli-core';
import { issueBffAccessToken } from '../../src/oauth/bff-token';
import createOpenApiRoutes, { OPENAPI_PATH } from '../../src/openapi/openapi-routes';
import ReadModel from '../../src/read-model/read-model';
import { action, collection, column, relation } from '../read-model/fixtures';

const SCHEMA = [
  collection(
    'users',
    [column('id'), column('email'), relation('orders', 'HasMany', 'orders.userId')],
    [action('Mark as paid', '/forest/users/actions/mark-as-paid')],
  ),
  collection('orders', [column('id'), column('label')]),
];

const CAPABILITIES = {
  fields: [
    { name: 'id', type: 'Number', operators: ['equal'] },
    { name: 'email', type: 'String', operators: ['equal', 'like'] },
  ],
};

const fetchSchema = jest.fn().mockResolvedValue(SCHEMA);
const fetchCapabilities = jest.fn().mockResolvedValue(CAPABILITIES);

jest.mock('../../src/read-model/forest-schema-client', () => ({
  __esModule: true,
  default: class {
    // eslint-disable-next-line class-methods-use-this
    fetchSchema() {
      return fetchSchema();
    }
  },
}));

jest.mock('../../src/read-model/agent-capabilities-fetcher', () => ({
  __esModule: true,
  default: () => fetchCapabilities,
}));

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
  beforeEach(() => {
    fetchSchema.mockClear().mockResolvedValue(SCHEMA);
    fetchCapabilities.mockClear().mockResolvedValue(CAPABILITIES);
  });

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
    it('should serve a document unfolded from the deployment schema', async () => {
      await withServer(VALID_ENV, async server => {
        const response = await request(server.callback)
          .get(OPENAPI_PATH)
          .set('Authorization', `Bearer ${sessionToken()}`);

        expect(response.status).toBe(200);
        expect(response.body.openapi).toBe('3.1.0');
        expect(Object.keys(response.body.paths).sort()).toEqual([
          '/agent/v1/orders/count',
          '/agent/v1/orders/list',
          '/agent/v1/users/actions/Mark%20as%20paid/execute',
          '/agent/v1/users/actions/Mark%20as%20paid/form',
          '/agent/v1/users/count',
          '/agent/v1/users/list',
          '/agent/v1/users/relations/orders/count',
          '/agent/v1/users/relations/orders/list',
        ]);
      });
    });

    it('should enumerate the collection fields, which is what the unfolding is for', async () => {
      await withServer(VALID_ENV, async server => {
        const response = await request(server.callback)
          .get(OPENAPI_PATH)
          .set('Authorization', `Bearer ${sessionToken()}`);

        expect(response.body.components.schemas.Fields_users).toEqual(
          expect.objectContaining({ type: 'string', enum: ['id', 'email'] }),
        );
      });
    });

    it('should ask the agent for capabilities once per collection, not once per path', async () => {
      await withServer(VALID_ENV, async server => {
        await request(server.callback)
          .get(OPENAPI_PATH)
          .set('Authorization', `Bearer ${sessionToken()}`);

        expect(fetchCapabilities.mock.calls).toEqual([['orders'], ['users']]);
      });
    });

    it('should forbid caching, matching the no-store the api key path already sets', async () => {
      await withServer(VALID_ENV, async server => {
        const response = await request(server.callback)
          .get(OPENAPI_PATH)
          .set('Authorization', `Bearer ${sessionToken()}`);

        expect(response.headers['cache-control']).toBe('no-store');
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
    it('should serve the generic document, since there is nothing to unfold against', async () => {
      await withServer({ ...VALID_ENV, AGENT_URL: undefined }, async server => {
        const response = await request(server.callback)
          .get(OPENAPI_PATH)
          .set('Authorization', `Bearer ${sessionToken()}`);

        expect(response.status).toBe(200);
        expect(Object.keys(response.body.paths)).toHaveLength(6);
        expect(response.body.info.description).toContain('Paths are generic');
        expect(fetchSchema).not.toHaveBeenCalled();
      });
    });
  });

  describe('when the schema cannot be read', () => {
    it('should answer 503 rather than a generic document that looks complete', async () => {
      fetchSchema.mockRejectedValue(new Error('forest server is down'));

      await withServer(VALID_ENV, async server => {
        const response = await request(server.callback)
          .get(OPENAPI_PATH)
          .set('Authorization', `Bearer ${sessionToken()}`);

        expect(response.status).toBe(503);
        expect(response.body.error.type).toBe('schema_unavailable');
      });
    });
  });

  describe('when a collection has no capabilities', () => {
    it('should keep its paths with free-form field schemas instead of dropping it', async () => {
      fetchCapabilities.mockImplementation(async (name: string) => {
        if (name === 'orders') throw new Error('agent is down');

        return CAPABILITIES;
      });

      await withServer(VALID_ENV, async server => {
        const response = await request(server.callback)
          .get(OPENAPI_PATH)
          .set('Authorization', `Bearer ${sessionToken()}`);

        expect(response.status).toBe(200);
        expect(Object.keys(response.body.paths)).toContain('/agent/v1/orders/list');
        expect(response.body.components.schemas.Fields_orders).toBeUndefined();
        expect(response.body.components.schemas.ListRequest_orders.properties.projection).toEqual({
          type: 'array',
          items: { type: 'string' },
        });
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
    it('should return the byte-identical document, built once per schema generation', async () => {
      await withServer(VALID_ENV, async server => {
        const token = sessionToken();
        const first = await request(server.callback)
          .get(OPENAPI_PATH)
          .set('Authorization', `Bearer ${token}`);
        const second = await request(server.callback)
          .get(OPENAPI_PATH)
          .set('Authorization', `Bearer ${token}`);

        expect(first.text).toBe(second.text);
        expect(fetchCapabilities).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('when the schema refreshes while the document is being built', () => {
    function readContext() {
      return {
        path: OPENAPI_PATH,
        method: 'GET',
        state: { agentToken: 'agent-jwt' },
        status: 404,
        body: undefined as unknown,
        type: undefined,
        set: () => undefined,
      } as unknown as Parameters<Middleware>[0];
    }

    function storeOf(generations: ReadModel[]) {
      const last = generations[generations.length - 1];

      return {
        getReadModel: jest.fn(async () => generations.shift() ?? last),
        getCapabilities: async (
          name: string,
          fetcher: (collection: string) => Promise<unknown>,
        ) => ({
          capabilities: await fetcher(name),
          readModel: last,
        }),
      } as unknown as ReadModelStore;
    }

    function routesFor(store: ReadModelStore): Middleware {
      return createOpenApiRoutes({
        version: '1.2.3',
        enabled: true,
        source: { store, agentUrl: 'https://agent.example.com', logger: noopLogger },
      });
    }

    const oldGeneration = new ReadModel([collection('users', [column('id')])]);
    const newGeneration = new ReadModel([collection('orders', [column('id')])]);

    it('should serve the new generation rather than a document mixing the two', async () => {
      // Read once before the build, once after: the second read observes the refresh, so the
      // document built from the old collections with the new field sets is thrown away.
      const store = storeOf([oldGeneration, newGeneration, newGeneration, newGeneration]);
      const ctx = readContext();

      await routesFor(store)(ctx, async () => undefined);

      expect(Object.keys(JSON.parse(ctx.body as string).paths)).toEqual([
        '/agent/v1/orders/list',
        '/agent/v1/orders/count',
      ]);
    });

    it('should give up rather than loop when the schema keeps changing under it', async () => {
      const store = {
        getReadModel: async () => new ReadModel([collection('users', [column('id')])]),
        getCapabilities: async (
          name: string,
          fetcher: (collection: string) => Promise<unknown>,
        ) => ({
          capabilities: await fetcher(name),
          readModel: newGeneration,
        }),
      } as unknown as ReadModelStore;

      await expect(routesFor(store)(readContext(), async () => undefined)).rejects.toThrow(
        /kept changing/,
      );
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

  describe('when the middleware is invoked directly on a request it does not own', () => {
    function fakeContext(path: string, method = 'GET') {
      return {
        path,
        method,
        status: 404,
        body: undefined,
        type: undefined,
      } as unknown as Parameters<Middleware>[0];
    }

    it.each([
      ['a path it does not own', '/agent/data/books', 'GET', true],
      ['a write method on the document path', OPENAPI_PATH, 'POST', true],
      ['a write method while the document is disabled', OPENAPI_PATH, 'POST', false],
    ])(
      'should delegate to the next middleware and touch nothing on %s',
      async (_, path, method, enabled) => {
        const openApiRoutes = createOpenApiRoutes({ version: '1.2.3', enabled });
        const ctx = fakeContext(path, method);
        const next = jest.fn().mockResolvedValue(undefined);

        await openApiRoutes(ctx, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(ctx.body).toBeUndefined();
        expect(ctx.type).toBeUndefined();
        expect(ctx.status).toBe(404);
      },
    );
  });

  describe('when BFF_OPENAPI_ENABLED is false', () => {
    const disabledEnv = { ...VALID_ENV, BFF_OPENAPI_ENABLED: 'false' };

    it('should still reject an unauthenticated caller with 401', async () => {
      await withServer(disabledEnv, async server => {
        const response = await request(server.callback).get(OPENAPI_PATH);

        expect(response.status).toBe(401);
        expect(response.text).not.toContain('"openapi"');
      });
    });

    it('should answer 404 to an authenticated caller, without requiring a timezone', async () => {
      await withServer(disabledEnv, async server => {
        const response = await request(server.callback)
          .get(OPENAPI_PATH)
          .set('Authorization', `Bearer ${sessionToken()}`);

        expect(response.status).toBe(404);
        expect(response.body.error.type).toBe('openapi_disabled');
        expect(response.text).not.toContain('"openapi"');
      });
    });

    it('should answer a POST exactly like the enabled route, since the gate only covers reads', async () => {
      const postDocumentPath = async (env: NodeJS.ProcessEnv) => {
        let result: { status: number; type: unknown } = { status: 0, type: undefined };

        await withServer(env, async server => {
          const response = await request(server.callback)
            .post(OPENAPI_PATH)
            .set('Authorization', `Bearer ${sessionToken()}`)
            .send({});

          result = { status: response.status, type: response.body?.error?.type };
        });

        return result;
      };

      const disabled = await postDocumentPath(disabledEnv);
      const enabled = await postDocumentPath(VALID_ENV);

      expect(disabled).toEqual(enabled);
      expect(disabled.type).not.toBe('openapi_disabled');
    });
  });
});
