import type { AgentCapabilitiesFetcherOptions } from '../../src/read-model/agent-capabilities-fetcher';
import type { CapabilitiesResult } from '../../src/read-model/capabilities-cache';
import type { SchemaFetcher } from '../../src/read-model/forest-schema-client';

import { AgentHttpError } from '@forestadmin/agent-client';
import Koa from 'koa';
import request from 'supertest';

import { createHttpTransport } from '../../src/agent/agent-transport';
import createFilterOperatorsRoutesMiddleware from '../../src/filter-operators/filter-operators-routes-middleware';
import createErrorMiddleware from '../../src/http/error-middleware';
import CapabilitiesCache from '../../src/read-model/capabilities-cache';
import ReadModel from '../../src/read-model/read-model';
import ReadModelStore from '../../src/read-model/read-model-store';
import SchemaCache from '../../src/read-model/schema-cache';
import { collection, column, makeMetrics, published } from '../read-model/fixtures';

const TRANSPORT = createHttpTransport({ agentUrl: 'https://agent.example.com' });
const ROUTE = '/agent/v1/collections/users/filter-operators';

const USERS_CAPABILITIES: CapabilitiesResult = {
  fields: [
    { name: 'id', type: 'Number', operators: ['in', 'equal', 'equal'] },
    { name: 'email', type: 'String', operators: ['contains', 'equal', 'present'] },
    { name: 'avatar', type: 'File', operators: [] },
    { name: 'notes', type: 'String' },
    { name: 'skewed', type: 'String', operators: ['equal', 'operator_from_the_future'] },
  ],
};

function makeStore() {
  const fetcher: SchemaFetcher = {
    fetchSchema: jest
      .fn()
      .mockResolvedValue(
        published([
          collection('users', [column('id'), column('email')]),
          collection('toString', []),
        ]),
      ),
  };

  return new ReadModelStore(
    new SchemaCache({ fetcher, metrics: makeMetrics() }),
    new CapabilitiesCache({}),
  );
}

function buildApp({
  store = makeStore(),
  capabilities = jest.fn().mockResolvedValue(USERS_CAPABILITIES),
  agentToken = 'agent-jwt' as string | null,
} = {}) {
  const createFetcher = jest.fn((options: AgentCapabilitiesFetcherOptions) => {
    expect(options.token).toBe(agentToken);

    return capabilities;
  });

  const app = new Koa();
  app.silent = true;
  app.use(createErrorMiddleware({ logger: () => undefined }));
  app.use(async (ctx, next) => {
    if (agentToken !== null) ctx.state.agentToken = agentToken;
    await next();
  });
  app.use(
    createFilterOperatorsRoutesMiddleware({
      store,
      transport: TRANSPORT,
      logger: () => undefined,
      createFetcher,
    }),
  );
  app.use(async ctx => {
    ctx.status = 418;
    ctx.body = { passthrough: true };
  });

  return { callback: app.callback(), capabilities, createFetcher };
}

describe('filterOperatorsRoutesMiddleware', () => {
  it('should answer each filterable field with its canonical operators', async () => {
    const { callback, capabilities } = buildApp();

    const response = await request(callback).get(ROUTE);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      collection: 'users',
      fields: [
        { field: 'id', operators: ['Equal', 'In'] },
        { field: 'email', operators: ['Equal', 'Present', 'Contains'] },
      ],
    });
    expect(capabilities).toHaveBeenCalledWith('users');
  });

  it('should answer an empty field list when the agent names no filterable field', async () => {
    const { callback } = buildApp({
      capabilities: jest.fn().mockResolvedValue({ fields: [{ name: 'id', type: 'Number' }] }),
    });

    const response = await request(callback).get(ROUTE);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ collection: 'users', fields: [] });
  });

  it('should reuse the warm capabilities cache instead of calling the agent again', async () => {
    const { callback, capabilities } = buildApp();

    await request(callback).get(ROUTE);
    const second = await request(callback).get(ROUTE);

    expect(second.status).toBe(200);
    expect(capabilities).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['an unknown collection', '/agent/v1/collections/orders/filter-operators', 'orders'],
    [
      'an Object.prototype name',
      '/agent/v1/collections/constructor/filter-operators',
      'constructor',
    ],
  ])(
    'should answer 404 unknown_collection for %s without asking the agent',
    async (_, path, name) => {
      const { callback, capabilities } = buildApp();

      const response = await request(callback).get(path);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: { type: 'unknown_collection', status: 404, message: `Unknown collection: ${name}` },
      });
      expect(capabilities).not.toHaveBeenCalled();
    },
  );

  it('should decode the collection segment before checking the allow-list', async () => {
    const { callback, capabilities } = buildApp();

    const response = await request(callback).get(
      '/agent/v1/collections/to%53tring/filter-operators',
    );

    expect(response.status).toBe(200);
    expect(response.body.collection).toBe('toString');
    expect(capabilities).toHaveBeenCalledWith('toString');
  });

  it('should answer 400 on a malformed collection segment', async () => {
    const { callback, capabilities } = buildApp();

    const response = await request(callback).get('/agent/v1/collections/%E0%A4%A/filter-operators');

    expect(response.status).toBe(400);
    expect(response.body.error.type).toBe('invalid_request');
    expect(capabilities).not.toHaveBeenCalled();
  });

  it('should answer 401 when the request carries no agent credentials', async () => {
    const { callback, capabilities } = buildApp({ agentToken: null });

    const response = await request(callback).get(ROUTE);

    expect(response.status).toBe(401);
    expect(capabilities).not.toHaveBeenCalled();
  });

  it('should answer an explicit error, not an empty list, when the agent fails', async () => {
    const { callback } = buildApp({
      capabilities: jest
        .fn()
        .mockRejectedValue(new AgentHttpError(500, { errors: [{ detail: 'boom' }] })),
    });

    const response = await request(callback).get(ROUTE);

    expect(response.status).toBe(503);
    expect(response.body.error.type).toBe('agent_unavailable');
    expect(response.body).not.toHaveProperty('fields');
  });

  it('should not cache a failed capabilities read', async () => {
    const capabilities = jest
      .fn()
      .mockRejectedValueOnce(new AgentHttpError(500, { errors: [{ detail: 'boom' }] }))
      .mockResolvedValueOnce(USERS_CAPABILITIES);
    const { callback } = buildApp({ capabilities });

    await request(callback).get(ROUTE);
    const retry = await request(callback).get(ROUTE);

    expect(retry.status).toBe(200);
    expect(capabilities).toHaveBeenCalledTimes(2);
  });

  it('should answer 404 when a schema refresh drops the collection during the read', async () => {
    const store = makeStore();
    jest.spyOn(store, 'getCapabilities').mockResolvedValue({
      capabilities: USERS_CAPABILITIES,
      readModel: new ReadModel([]),
    });
    const { callback } = buildApp({ store });

    const response = await request(callback).get(ROUTE);

    expect(response.status).toBe(404);
    expect(response.body.error.type).toBe('unknown_collection');
    expect(response.body).not.toHaveProperty('fields');
  });

  it.each([
    ['a POST', 'post', ROUTE],
    ['another path', 'get', '/agent/v1/collections/users/fields'],
    ['a nested collection path', 'get', '/agent/v1/collections/a/b/filter-operators'],
  ])('should pass %s through', async (_, method, path) => {
    const { callback, capabilities } = buildApp();

    const response = await request(callback)[method as 'get' | 'post'](path);

    expect(response.status).toBe(418);
    expect(capabilities).not.toHaveBeenCalled();
  });
});
