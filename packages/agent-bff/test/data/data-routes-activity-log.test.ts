import type { ActivityLogWriter } from '../../src/activity-log/activity-log-writer';
import type { AgentDataClient } from '../../src/data/agent-data-client';
import type { Logger } from '../../src/ports/logger-port';
import type ReadModelStore from '../../src/read-model/read-model-store';
import type { Middleware } from 'koa';

import { HttpError } from '@forestadmin/forestadmin-client';
import { bodyParser } from '@koa/bodyparser';
import Koa from 'koa';
import request from 'supertest';

import { createHttpTransport } from '../../src/agent/agent-transport';
import createDataRoutesMiddleware from '../../src/data/data-routes-middleware';
import createErrorMiddleware from '../../src/http/error-middleware';
import ReadModel from '../../src/read-model/read-model';
import {
  ACTIVITY_LOG_ID,
  ACTIVITY_LOG_INDEX,
  API_KEY_SERVER_TOKEN,
  RENDERING_ID,
  activityLogsOf,
  apiKeyCredentials,
  fakeActivityLogsService,
  forestServerTokenStep,
  oauthCredentials,
  sessionAccessToken,
} from '../helpers/activity-log';
import { collection, column, relation } from '../read-model/fixtures';

const AGENT_URL = 'https://agent.example.com';
const TIMEZONE = 'Europe/Paris';
const OPERATORS = ['present', 'blank', 'equal', 'not_equal', 'in', 'like'];
const EMAIL_FILTER = { field: 'email', operator: 'Equal', value: 'joe@example.com' };
const TITLE_FILTER = { field: 'title', operator: 'Equal', value: 'hello' };

const noopLogger: Logger = () => undefined;

const readModel = new ReadModel([
  collection('users', [column('id'), column('email'), relation('posts', 'HasMany', 'posts.id')]),
  collection('posts', [column('id'), column('title')]),
]);

function storeOf(): ReadModelStore {
  return {
    getReadModel: async () => readModel,
    getCapabilities: async () => ({
      capabilities: {
        fields: ['id', 'email', 'title'].map(name => ({
          name,
          type: 'String',
          operators: OPERATORS,
        })),
      },
      readModel,
    }),
  } as unknown as ReadModelStore;
}

function buildApp({
  service,
  client,
  credentials = apiKeyCredentials(),
  saasAccessToken,
  logger = noopLogger,
}: {
  service: ReturnType<typeof fakeActivityLogsService>;
  client: Partial<AgentDataClient>;
  credentials?: Middleware;
  saasAccessToken?: string;
  logger?: Logger;
}): { app: Koa; activityLogs: ActivityLogWriter } {
  const activityLogs = activityLogsOf(service, logger);
  const app = new Koa();
  app.silent = true;
  app.use(createErrorMiddleware({ logger: noopLogger }));
  app.use(bodyParser());
  app.use(credentials);
  app.use(forestServerTokenStep(saasAccessToken));
  app.use(async (ctx, next) => {
    ctx.state.timezone = TIMEZONE;
    ctx.state.agentToken = 'agent-jwt';
    await next();
  });
  app.use(
    createDataRoutesMiddleware({
      store: storeOf(),
      transport: createHttpTransport({ agentUrl: AGENT_URL }),
      logger,
      activityLogs,
      createClient: () => client as AgentDataClient,
    }),
  );

  return { app, activityLogs };
}

describe('data routes activity log', () => {
  describe('when listing records', () => {
    it('should record a search when the body carries a search and a filter', async () => {
      const service = fakeActivityLogsService();
      const { app } = buildApp({ service, client: { list: async () => [] } });

      const response = await request(app.callback())
        .post('/agent/v1/users/list')
        .send({ search: 'joe', filter: EMAIL_FILTER });

      expect(response.status).toBe(200);
      expect(service.createMcpActivityLog).toHaveBeenCalledWith({
        forestServerToken: API_KEY_SERVER_TOKEN,
        renderingId: String(RENDERING_ID),
        action: 'search',
        type: 'read',
        collectionName: 'users',
        recordId: undefined,
        recordIds: undefined,
        label: undefined,
      });
    });

    it('should record a filter when the body carries a filter and no search', async () => {
      const service = fakeActivityLogsService();
      const { app } = buildApp({ service, client: { list: async () => [] } });

      const response = await request(app.callback())
        .post('/agent/v1/users/list')
        .send({ filter: EMAIL_FILTER });

      expect(response.status).toBe(200);
      expect(service.createMcpActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'filter', type: 'read', collectionName: 'users' }),
      );
    });

    it('should record an index when the body carries neither a search nor a filter', async () => {
      const service = fakeActivityLogsService();
      const { app } = buildApp({ service, client: { list: async () => [] } });

      const response = await request(app.callback()).post('/agent/v1/users/list').send({});

      expect(response.status).toBe(200);
      expect(service.createMcpActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'index', type: 'read' }),
      );
    });

    it('should mark the log completed once the records are served', async () => {
      const service = fakeActivityLogsService();
      const { app, activityLogs } = buildApp({ service, client: { list: async () => [] } });

      await request(app.callback()).post('/agent/v1/users/list').send({});
      await activityLogs.drain();

      expect(service.updateActivityLogStatus).toHaveBeenCalledWith({
        forestServerToken: API_KEY_SERVER_TOKEN,
        activityLog: { id: ACTIVITY_LOG_ID, attributes: { index: ACTIVITY_LOG_INDEX } },
        status: 'completed',
      });
    });

    it('should mark the log failed when the agent refuses the list', async () => {
      const service = fakeActivityLogsService();
      const { app, activityLogs } = buildApp({
        service,
        client: {
          list: async () => {
            throw new Error('agent is down');
          },
        },
      });

      const response = await request(app.callback()).post('/agent/v1/users/list').send({});
      await activityLogs.drain();

      expect(response.status).toBe(502);
      expect(service.updateActivityLogStatus).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed' }),
      );
    });

    it('should serve the records and warn when the log cannot be created', async () => {
      const service = fakeActivityLogsService({
        createMcpActivityLog: jest.fn(async () => {
          throw new Error('the audit store is down');
        }),
      });
      const logger = jest.fn();
      const list = jest.fn(async () => []);
      const { app } = buildApp({ service, client: { list }, logger });

      const response = await request(app.callback()).post('/agent/v1/users/list').send({});

      expect(response.status).toBe(200);
      expect(list).toHaveBeenCalledTimes(1);
      expect(logger).toHaveBeenCalledWith(
        'Warn',
        expect.stringContaining("Activity log for 'index' was not created"),
      );
    });

    it('should refuse the list when the audit endpoint rejects the identity', async () => {
      const service = fakeActivityLogsService({
        createMcpActivityLog: jest.fn(async () => {
          throw new HttpError('Forbidden', 403);
        }),
      });
      const list = jest.fn(async () => []);
      const { app } = buildApp({ service, client: { list } });

      const response = await request(app.callback()).post('/agent/v1/users/list').send({});

      expect(response.status).toBe(403);
      expect(response.body.error.type).toBe('audit_not_authorized');
      expect(list).not.toHaveBeenCalled();
    });

    it('should serve the records unaudited when the oauth session cannot be resolved', async () => {
      const service = fakeActivityLogsService();
      const list = jest.fn(async () => []);
      const { app } = buildApp({
        service,
        client: { list },
        credentials: oauthCredentials(),
        saasAccessToken: undefined,
      });

      const response = await request(app.callback()).post('/agent/v1/users/list').send({});

      expect(response.status).toBe(200);
      expect(list).toHaveBeenCalledTimes(1);
      expect(service.createMcpActivityLog).not.toHaveBeenCalled();
    });

    it('should use the session token when the caller carries an oauth session', async () => {
      const service = fakeActivityLogsService();
      const saasAccessToken = sessionAccessToken();
      const { app } = buildApp({
        service,
        client: { list: async () => [] },
        credentials: oauthCredentials(),
        saasAccessToken,
      });

      await request(app.callback()).post('/agent/v1/users/list').send({});

      expect(service.createMcpActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({ forestServerToken: saasAccessToken }),
      );
    });
  });

  describe('when listing a relation', () => {
    it('should record the parent record and label the refinements it was given', async () => {
      const service = fakeActivityLogsService();
      const { app } = buildApp({ service, client: { listRelation: async () => [] } });

      const response = await request(app.callback())
        .post('/agent/v1/users/relations/posts/list')
        .send({ parentId: 'users-1', search: 'hello', filter: TITLE_FILTER });

      expect(response.status).toBe(200);
      expect(service.createMcpActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'listRelatedData',
          type: 'read',
          collectionName: 'users',
          recordId: 'users-1',
          label: 'list relation "posts" with search and filter',
        }),
      );
    });

    it('should label a relation list carrying only a search', async () => {
      const service = fakeActivityLogsService();
      const { app } = buildApp({ service, client: { listRelation: async () => [] } });

      await request(app.callback())
        .post('/agent/v1/users/relations/posts/list')
        .send({ parentId: 'users-1', search: 'hello' });

      expect(service.createMcpActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'list relation "posts" with search' }),
      );
    });

    it('should label a plain relation list without a refinement suffix', async () => {
      const service = fakeActivityLogsService();
      const { app } = buildApp({ service, client: { listRelation: async () => [] } });

      await request(app.callback())
        .post('/agent/v1/users/relations/posts/list')
        .send({ parentId: 'users-1' });

      expect(service.createMcpActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'list relation "posts"' }),
      );
    });
  });

  describe('when counting records', () => {
    it('should write no log for a count', async () => {
      const service = fakeActivityLogsService();
      const { app } = buildApp({ service, client: { countRaw: async () => ({ count: 3 }) } });

      const response = await request(app.callback())
        .post('/agent/v1/users/count')
        .send({ filter: EMAIL_FILTER });

      expect(response.status).toBe(200);
      expect(service.createMcpActivityLog).not.toHaveBeenCalled();
    });

    it('should write no log for a relation count', async () => {
      const service = fakeActivityLogsService();
      const { app } = buildApp({
        service,
        client: { countRelationRaw: async () => ({ count: 1 }) },
      });

      const response = await request(app.callback())
        .post('/agent/v1/users/relations/posts/count')
        .send({ parentId: 'users-1' });

      expect(response.status).toBe(200);
      expect(service.createMcpActivityLog).not.toHaveBeenCalled();
    });
  });
});
