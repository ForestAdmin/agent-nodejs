import type { SchemaFetcher } from '../../src/read-model/forest-schema-client';
import type { ForestSchemaCollection } from '@forestadmin/forestadmin-client';

import jsonwebtoken from 'jsonwebtoken';
import Koa from 'koa';
import request from 'supertest';

import schemaCoveringEveryContractShape from './fixtures';
import createApiKeyMiddleware, { BFF_KEY_HEADER } from '../../src/api-key/api-key-middleware';
import createAuthModeMiddleware from '../../src/auth/auth-mode-middleware';
import createContextRoutesMiddleware from '../../src/context/context-routes-middleware';
import createPerKeyOriginMiddleware from '../../src/cors/per-key-origin';
import createErrorMiddleware from '../../src/http/error-middleware';
import CapabilitiesCache from '../../src/read-model/capabilities-cache';
import ReadModelStore from '../../src/read-model/read-model-store';
import SchemaCache from '../../src/read-model/schema-cache';
import { makeMetrics } from '../read-model/fixtures';

const ROUTE = '/agent/v1/context';
const AUTH_SECRET = 'context-secret';
const RAW_KEY = `fbff_${'a'.repeat(16)}_${'b'.repeat(64)}`;

function makeRouteOnlyApp(fetchSchema: jest.Mock, environmentId?: number) {
  const fetcher: SchemaFetcher = { fetchSchema };
  const schemaCache = new SchemaCache({ fetcher, metrics: makeMetrics() });
  const store = new ReadModelStore(schemaCache, new CapabilitiesCache({}));

  const app = new Koa();
  app.use(createErrorMiddleware({ logger: () => {} }));
  app.use(createContextRoutesMiddleware({ store, environmentId }));

  return { app, schemaCache };
}

function apiKeyIdentity(allowedOrigins: string[] = []) {
  return {
    user: {
      id: 1,
      email: 'a@b.com',
      firstName: 'A',
      lastName: 'B',
      team: 'T',
      tags: [],
      permissionLevel: 'admin',
    },
    renderingId: 1,
    allowedOrigins,
  };
}

function makeFullAgentEdge(fetchSchema: jest.Mock, allowedOrigins: string[] = []) {
  const fetcher: SchemaFetcher = { fetchSchema };
  const schemaCache = new SchemaCache({ fetcher, metrics: makeMetrics() });
  const store = new ReadModelStore(schemaCache, new CapabilitiesCache({}));
  const logger = () => undefined;

  const app = new Koa();
  app.silent = true;
  app.use(createErrorMiddleware({ logger }));
  app.use(createAuthModeMiddleware({ authSecret: AUTH_SECRET }));
  app.use(
    createApiKeyMiddleware({
      authenticator: {
        authenticate: async () => ({
          agentToken: 'agent-token',
          identity: apiKeyIdentity(allowedOrigins),
        }),
      },
      logger,
    }),
  );
  app.use(createPerKeyOriginMiddleware());
  app.use(createContextRoutesMiddleware({ store }));

  return app.callback();
}

describe('contextRoutesMiddleware', () => {
  let schema: ForestSchemaCollection[];

  beforeEach(() => {
    schema = schemaCoveringEveryContractShape();
  });

  describe('when the route serves the contract', () => {
    it('should serve the contract with its collections and schema revision', async () => {
      const fetchSchema = jest.fn().mockResolvedValue(schema);
      const { app } = makeRouteOnlyApp(fetchSchema);

      const response = await request(app.callback()).get(ROUTE);

      expect(response.status).toBe(200);
      expect(response.body.collections.map((entry: { name: string }) => entry.name)).toEqual([
        'users',
        'User.address',
        'My Coll',
        'collectionWithoutFieldsNorActions',
      ]);
      expect(response.body.meta).toEqual({ schemaRevision: 1 });
    });

    it('should carry the environment id the deployment resolved at boot', async () => {
      const { app } = makeRouteOnlyApp(jest.fn().mockResolvedValue(schema), 42);

      const response = await request(app.callback()).get(ROUTE);

      expect(response.body.meta).toEqual({ schemaRevision: 1, environmentId: 42 });
    });

    it('should omit the environment id when the deployment resolved none', async () => {
      const { app } = makeRouteOnlyApp(jest.fn().mockResolvedValue(schema));

      const response = await request(app.callback()).get(ROUTE);

      expect(response.body.meta).toEqual({ schemaRevision: 1 });
    });

    it('should fetch the schema once on a cold cache and never again while it stays warm', async () => {
      const fetchSchema = jest.fn().mockResolvedValue(schema);
      const { app } = makeRouteOnlyApp(fetchSchema);

      await request(app.callback()).get(ROUTE);
      await request(app.callback()).get(ROUTE);

      expect(fetchSchema).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the schema cannot be read', () => {
    it('should answer 503 schema_unavailable rather than an empty contract', async () => {
      const fetchSchema = jest.fn().mockRejectedValue(new Error('agent down'));
      const { app } = makeRouteOnlyApp(fetchSchema);

      const response = await request(app.callback()).get(ROUTE);

      expect(response.status).toBe(503);
      expect(response.body.error).toMatchObject({ type: 'schema_unavailable', status: 503 });
    });
  });

  describe('when the caller authenticated with an API key through the full edge', () => {
    it('should serve the same contract an OAuth session gets, since the schema is not caller-scoped', async () => {
      const sessionToken = jsonwebtoken.sign(
        { type: 'bff_access', sid: 's1', rendering_id: '1', tags: {} },
        AUTH_SECRET,
        { algorithm: 'HS256', expiresIn: '15m' } as jsonwebtoken.SignOptions,
      );

      const keyResponse = await request(makeFullAgentEdge(jest.fn().mockResolvedValue(schema)))
        .get(ROUTE)
        .set(BFF_KEY_HEADER, RAW_KEY);
      const sessionResponse = await request(makeFullAgentEdge(jest.fn().mockResolvedValue(schema)))
        .get(ROUTE)
        .set('Authorization', `Bearer ${sessionToken}`);

      expect(keyResponse.status).toBe(200);
      expect(keyResponse.body.collections).toHaveLength(4);
      expect(keyResponse.body).toEqual(sessionResponse.body);
    });

    it('should refuse with 403 origin_not_allowed when the key does not allow the request origin', async () => {
      const response = await request(
        makeFullAgentEdge(jest.fn().mockResolvedValue(schema), ['https://ok.com']),
      )
        .get(ROUTE)
        .set(BFF_KEY_HEADER, RAW_KEY)
        .set('Origin', 'https://evil.com');

      expect(response.status).toBe(403);
      expect(response.body.error).toMatchObject({ type: 'origin_not_allowed', status: 403 });
    });
  });

  describe('when the path or method does not match', () => {
    it('should pass through to the next middleware', async () => {
      const fetchSchema = jest.fn().mockResolvedValue(schema);
      const { app } = makeRouteOnlyApp(fetchSchema);
      app.use(async ctx => {
        ctx.status = 418;
      });

      await expect(request(app.callback()).post(ROUTE)).resolves.toMatchObject({ status: 418 });
      await expect(request(app.callback()).get('/agent/v1/permissions')).resolves.toMatchObject({
        status: 418,
      });
    });
  });
});
