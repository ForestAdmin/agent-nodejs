import type { AgentDataClient } from '../../src/data/agent-data-client';
import type { Logger } from '../../src/ports/logger-port';
import type ReadModelStore from '../../src/read-model/read-model-store';

import { AgentHttpError } from '@forestadmin/agent-client';
import { bodyParser } from '@koa/bodyparser';
import Koa from 'koa';
import request from 'supertest';

import createDataRoutesMiddleware from '../../src/data/data-routes-middleware';
import createErrorMiddleware from '../../src/http/error-middleware';
import SchemaUnavailableError from '../../src/read-model/errors';
import ReadModel from '../../src/read-model/read-model';
import { collection, column } from '../read-model/fixtures';

const TIMEZONE = 'Europe/Paris';

const noopLogger: Logger = () => {};

function storeOf(readModel: ReadModel | Error): ReadModelStore {
  return {
    getReadModel: async () => {
      if (readModel instanceof Error) throw readModel;

      return readModel;
    },
  } as unknown as ReadModelStore;
}

const AGENT_URL = 'https://agent.example.com';

function buildApp(
  store: ReadModelStore,
  client: Partial<AgentDataClient>,
  {
    agentToken = 'agent-jwt',
    createClient = () => client as AgentDataClient,
  }: {
    agentToken?: string | null;
    createClient?: (options: { agentUrl: string; token: string }) => AgentDataClient;
  } = {},
) {
  const app = new Koa();
  app.silent = true;
  app.use(createErrorMiddleware({ logger: noopLogger }));
  app.use(bodyParser());
  app.use(async (ctx, next) => {
    ctx.state.timezone = TIMEZONE;
    if (agentToken !== null) ctx.state.agentToken = agentToken;
    await next();
  });
  app.use(
    createDataRoutesMiddleware({
      store,
      agentUrl: AGENT_URL,
      logger: noopLogger,
      createClient,
    }),
  );
  // Terminal sentinel: only reached when the dispatcher passes the request through via next().
  app.use(async ctx => {
    ctx.status = 418;
    ctx.body = { passthrough: true };
  });

  return app;
}

const usersReadModel = new ReadModel([collection('users', [column('id'), column('email')])]);

describe('data routes middleware', () => {
  describe('routing', () => {
    it('should pass non-data paths through to the next middleware', async () => {
      const list = jest.fn();
      const app = buildApp(storeOf(usersReadModel), { list });

      const response = await request(app.callback()).post('/agent/v1/users/other').send({});

      expect(response.status).toBe(418);
      expect(response.body).toEqual({ passthrough: true });
      expect(list).not.toHaveBeenCalled();
    });

    it('should pass a non-POST request on a data path through to the next middleware', async () => {
      const list = jest.fn();
      const app = buildApp(storeOf(usersReadModel), { list });

      const response = await request(app.callback()).get('/agent/v1/users/list');

      expect(response.status).toBe(418);
      expect(response.body).toEqual({ passthrough: true });
      expect(list).not.toHaveBeenCalled();
    });

    it('should forward the agent url and resolved token to the data client', async () => {
      const createClient = jest.fn(() => ({ list: async () => [] } as unknown as AgentDataClient));
      const app = buildApp(storeOf(usersReadModel), {}, { agentToken: 'jwt-123', createClient });

      await request(app.callback()).post('/agent/v1/users/list').send({});

      expect(createClient).toHaveBeenCalledWith({ agentUrl: AGENT_URL, token: 'jwt-123' });
    });
  });

  describe('list', () => {
    it('should return flat records with __forest and meta.countStatus not_requested', async () => {
      const list = jest.fn(async () => [{ id: '42', email: 'user@example.com' }]);
      const app = buildApp(storeOf(usersReadModel), { list });

      const response = await request(app.callback())
        .post('/agent/v1/users/list')
        .send({ projection: ['id', 'email'] });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        data: [
          {
            id: '42',
            email: 'user@example.com',
            __forest: { collection: 'users', primaryKey: { id: '42' } },
          },
        ],
        meta: { countStatus: 'not_requested' },
      });
    });

    it('should pass the resolved timezone to the agent query', async () => {
      const list = jest.fn(async () => []);
      const app = buildApp(storeOf(usersReadModel), { list });

      await request(app.callback()).post('/agent/v1/users/list').send({});

      expect(list).toHaveBeenCalledWith('users', expect.objectContaining({ timezone: TIMEZONE }));
    });

    it.each([['projection'], ['filter'], ['sort']])(
      'should reject a nested relation path in %s with 422',
      async surface => {
        const bodies: Record<string, object> = {
          projection: { projection: ['company:name'] },
          filter: { filter: { field: 'company:name', operator: 'present' } },
          sort: { sort: [{ field: 'company:name', direction: 'asc' }] },
        };
        const list = jest.fn(async () => []);
        const app = buildApp(storeOf(usersReadModel), { list });

        const response = await request(app.callback())
          .post('/agent/v1/users/list')
          .send(bodies[surface]);

        expect(response.status).toBe(422);
        expect(response.body.error).toMatchObject({
          type: 'relation_field_not_supported',
          status: 422,
          details: { fields: ['company:name'] },
        });
        expect(list).not.toHaveBeenCalled();
      },
    );

    it('should return 404 for an unknown collection', async () => {
      const app = buildApp(storeOf(usersReadModel), { list: jest.fn() });

      const response = await request(app.callback()).post('/agent/v1/ghosts/list').send({});

      expect(response.status).toBe(404);
      expect(response.body.error).toMatchObject({ type: 'unknown_collection', status: 404 });
    });

    it('should map an agent failure through the error contract', async () => {
      const list = jest.fn(async () => {
        throw new AgentHttpError(
          404,
          { errors: [{ status: 404, name: 'NotFoundError' }] },
          undefined,
        );
      });
      const app = buildApp(storeOf(usersReadModel), { list });

      const response = await request(app.callback()).post('/agent/v1/users/list').send({});

      expect(response.status).toBe(404);
      expect(response.body.error).toMatchObject({ type: 'not_found', status: 404 });
    });

    it('should return 503 schema_unavailable when the schema cannot be loaded', async () => {
      const app = buildApp(storeOf(new SchemaUnavailableError()), { list: jest.fn() });

      const response = await request(app.callback()).post('/agent/v1/users/list').send({});

      expect(response.status).toBe(503);
      expect(response.body.error).toMatchObject({ type: 'schema_unavailable', status: 503 });
    });

    it('should return 500 mapping_error when an agent record has no id', async () => {
      const list = jest.fn(async () => [{ email: 'user@example.com' }]);
      const app = buildApp(storeOf(usersReadModel), { list });

      const response = await request(app.callback()).post('/agent/v1/users/list').send({});

      expect(response.status).toBe(500);
      expect(response.body.error).toMatchObject({ type: 'mapping_error', status: 500 });
    });

    it('should rethrow a non-schema read-model error as a 500', async () => {
      const app = buildApp(storeOf(new Error('boom')), { list: jest.fn() });

      const response = await request(app.callback()).post('/agent/v1/users/list').send({});

      expect(response.status).toBe(500);
      expect(response.body.error).toMatchObject({ type: 'internal_error', status: 500 });
    });

    it('should return 401 when no agent token is available (e.g. OAuth mode)', async () => {
      const list = jest.fn();
      const app = buildApp(storeOf(usersReadModel), { list }, { agentToken: null });

      const response = await request(app.callback()).post('/agent/v1/users/list').send({});

      expect(response.status).toBe(401);
      expect(response.body.error).toMatchObject({ type: 'unauthorized', status: 401 });
      expect(list).not.toHaveBeenCalled();
    });

    it('should return 400 for a malformed percent-encoded collection name', async () => {
      const app = buildApp(storeOf(usersReadModel), { list: jest.fn() });

      const response = await request(app.callback()).post('/agent/v1/%E0%A4%A/list').send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({ type: 'invalid_request', status: 400 });
    });

    it('should return 400 when projection is not an array instead of a 500', async () => {
      const list = jest.fn();
      const app = buildApp(storeOf(usersReadModel), { list });

      const response = await request(app.callback())
        .post('/agent/v1/users/list')
        .send({ projection: 'id' });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({ type: 'invalid_request', status: 400 });
      expect(list).not.toHaveBeenCalled();
    });

    it('should expose a Number primary key as a number in __forest.primaryKey', async () => {
      const numericPkReadModel = new ReadModel([
        collection('metrics', [{ ...column('id'), type: 'Number' }]),
      ]);
      const list = jest.fn(async () => [{ id: '42', value: 10 }]);
      const app = buildApp(storeOf(numericPkReadModel), { list });

      const response = await request(app.callback()).post('/agent/v1/metrics/list').send({});

      expect(response.status).toBe(200);
      expect(response.body.data[0]).toMatchObject({
        __forest: { collection: 'metrics', primaryKey: { id: 42 } },
      });
    });
  });

  describe('count', () => {
    it('should return available with the numeric count', async () => {
      const countRaw = jest.fn(async () => ({ count: 7 }));
      const app = buildApp(storeOf(usersReadModel), { countRaw });

      const response = await request(app.callback()).post('/agent/v1/users/count').send({});

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ count: 7, countStatus: 'available' });
    });

    it('should return deactivated from the raw agent payload', async () => {
      const countRaw = jest.fn(async () => ({ meta: { count: 'deactivated' } }));
      const app = buildApp(storeOf(usersReadModel), { countRaw });

      const response = await request(app.callback()).post('/agent/v1/users/count').send({});

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ count: null, countStatus: 'deactivated' });
    });

    it('should reject a nested relation path in the count filter with 422', async () => {
      const countRaw = jest.fn();
      const app = buildApp(storeOf(usersReadModel), { countRaw });

      const response = await request(app.callback())
        .post('/agent/v1/users/count')
        .send({ filter: { field: 'company:name', operator: 'present' } });

      expect(response.status).toBe(422);
      expect(response.body.error).toMatchObject({
        type: 'relation_field_not_supported',
        status: 422,
      });
      expect(countRaw).not.toHaveBeenCalled();
    });

    it('should return 401 when no agent token is available', async () => {
      const countRaw = jest.fn();
      const app = buildApp(storeOf(usersReadModel), { countRaw }, { agentToken: null });

      const response = await request(app.callback()).post('/agent/v1/users/count').send({});

      expect(response.status).toBe(401);
      expect(response.body.error).toMatchObject({ type: 'unauthorized', status: 401 });
      expect(countRaw).not.toHaveBeenCalled();
    });

    it('should map an agent failure through the error contract', async () => {
      const countRaw = jest.fn(async () => {
        throw new AgentHttpError(
          404,
          { errors: [{ status: 404, name: 'NotFoundError' }] },
          undefined,
        );
      });
      const app = buildApp(storeOf(usersReadModel), { countRaw });

      const response = await request(app.callback()).post('/agent/v1/users/count').send({});

      expect(response.status).toBe(404);
      expect(response.body.error).toMatchObject({ type: 'not_found', status: 404 });
    });

    it('should return 404 for an unknown collection', async () => {
      const countRaw = jest.fn();
      const app = buildApp(storeOf(usersReadModel), { countRaw });

      const response = await request(app.callback()).post('/agent/v1/ghosts/count').send({});

      expect(response.status).toBe(404);
      expect(response.body.error).toMatchObject({ type: 'unknown_collection', status: 404 });
      expect(countRaw).not.toHaveBeenCalled();
    });

    it('should return 503 schema_unavailable when the schema cannot be loaded', async () => {
      const app = buildApp(storeOf(new SchemaUnavailableError()), { countRaw: jest.fn() });

      const response = await request(app.callback()).post('/agent/v1/users/count').send({});

      expect(response.status).toBe(503);
      expect(response.body.error).toMatchObject({ type: 'schema_unavailable', status: 503 });
    });

    it('should pass the resolved timezone to the agent query', async () => {
      const countRaw = jest.fn(async () => ({ count: 0 }));
      const app = buildApp(storeOf(usersReadModel), { countRaw });

      await request(app.callback()).post('/agent/v1/users/count').send({});

      expect(countRaw).toHaveBeenCalledWith(
        'users',
        expect.objectContaining({ timezone: TIMEZONE }),
      );
    });

    it('should return 500 mapping_error when the count payload is unusable', async () => {
      const countRaw = jest.fn(async () => ({}));
      const app = buildApp(storeOf(usersReadModel), { countRaw });

      const response = await request(app.callback()).post('/agent/v1/users/count').send({});

      expect(response.status).toBe(500);
      expect(response.body.error).toMatchObject({ type: 'mapping_error', status: 500 });
    });
  });
});
