import type { SchemaFetcher } from '../../src/read-model/forest-schema-client';
import type { ForestSchemaCollection } from '@forestadmin/forestadmin-client';

import Koa from 'koa';
import request from 'supertest';

import schemaCoveringEveryContractShape from './fixtures';
import createContextRoutesMiddleware from '../../src/context/context-routes-middleware';
import createErrorMiddleware from '../../src/http/error-middleware';
import CapabilitiesCache from '../../src/read-model/capabilities-cache';
import ReadModelStore from '../../src/read-model/read-model-store';
import SchemaCache from '../../src/read-model/schema-cache';
import { makeMetrics } from '../read-model/fixtures';

const ROUTE = '/agent/v1/context';

function makeApp(fetchSchema: jest.Mock, authMode: string | undefined = 'oauth') {
  const fetcher: SchemaFetcher = { fetchSchema };
  const schemaCache = new SchemaCache({ fetcher, metrics: makeMetrics() });
  const store = new ReadModelStore(schemaCache, new CapabilitiesCache({}));

  const app = new Koa();
  app.use(createErrorMiddleware({ logger: () => {} }));
  app.use(async (ctx, next) => {
    ctx.state.authMode = authMode;
    await next();
  });
  app.use(createContextRoutesMiddleware({ store }));

  return { app, schemaCache };
}

describe('contextRoutesMiddleware', () => {
  let schema: ForestSchemaCollection[];

  beforeEach(() => {
    schema = schemaCoveringEveryContractShape();
  });

  describe('when the caller holds an OAuth session', () => {
    it('should serve the contract with its collections and schema revision', async () => {
      const fetchSchema = jest.fn().mockResolvedValue(schema);
      const { app } = makeApp(fetchSchema);

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

    it('should fetch the schema once on a cold cache and never again while it stays warm', async () => {
      const fetchSchema = jest.fn().mockResolvedValue(schema);
      const { app } = makeApp(fetchSchema);

      await request(app.callback()).get(ROUTE);
      await request(app.callback()).get(ROUTE);

      expect(fetchSchema).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the schema cannot be read', () => {
    it('should answer 503 schema_unavailable rather than an empty contract', async () => {
      const fetchSchema = jest.fn().mockRejectedValue(new Error('agent down'));
      const { app } = makeApp(fetchSchema);

      const response = await request(app.callback()).get(ROUTE);

      expect(response.status).toBe(503);
      expect(response.body.error).toMatchObject({ type: 'schema_unavailable', status: 503 });
    });
  });

  describe('when the caller authenticated with an API key', () => {
    it('should refuse with 403 oauth_required', async () => {
      const fetchSchema = jest.fn().mockResolvedValue(schema);
      const { app } = makeApp(fetchSchema, 'api-key');

      const response = await request(app.callback()).get(ROUTE);

      expect(response.status).toBe(403);
      expect(response.body.error).toMatchObject({ type: 'oauth_required', status: 403 });
      expect(fetchSchema).not.toHaveBeenCalled();
    });
  });

  describe('when no timezone is supplied', () => {
    it('should still answer 200, because the contract needs no timezone', async () => {
      const fetchSchema = jest.fn().mockResolvedValue(schema);
      const { app } = makeApp(fetchSchema);

      const response = await request(app.callback()).get(ROUTE).unset('X-Forest-Timezone');

      expect(response.status).toBe(200);
    });
  });

  describe('when the path or method does not match', () => {
    it('should pass through to the next middleware', async () => {
      const fetchSchema = jest.fn().mockResolvedValue(schema);
      const { app } = makeApp(fetchSchema);
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
