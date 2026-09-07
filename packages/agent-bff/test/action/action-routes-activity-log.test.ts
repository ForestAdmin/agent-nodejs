import type { AgentActionClient } from '../../src/action/agent-action-client';
import type { ActivityLogWriter } from '../../src/activity-log/activity-log-writer';
import type { Logger } from '../../src/ports/logger-port';
import type { Middleware } from 'koa';

import { ActionRequiresApprovalError } from '@forestadmin/agent-client';
import { HttpError } from '@forestadmin/forestadmin-client';
import { bodyParser } from '@koa/bodyparser';
import Koa from 'koa';
import request from 'supertest';

import createActionRoutesMiddleware from '../../src/action/action-routes-middleware';
import { createHttpTransport } from '../../src/agent/agent-transport';
import createErrorMiddleware from '../../src/http/error-middleware';
import { TIMEZONE, clientOf, makeAction, readModel, storeOf } from '../helpers/action-routes';
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

const noopLogger: Logger = () => undefined;

function buildApp({
  service,
  client,
  credentials = apiKeyCredentials(),
  saasAccessToken,
}: {
  service: ReturnType<typeof fakeActivityLogsService>;
  client: AgentActionClient;
  credentials?: Middleware;
  saasAccessToken?: string;
}): { app: Koa; activityLogs: ActivityLogWriter } {
  const activityLogs = activityLogsOf(service, noopLogger);
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
    createActionRoutesMiddleware({
      store: storeOf(readModel),
      transport: createHttpTransport({ agentUrl: 'https://agent.example.com' }),
      logger: noopLogger,
      activityLogs,
      createClient: () => client,
    }),
  );

  return { app, activityLogs };
}

function executingAction() {
  return makeAction({ execute: jest.fn(async () => ({ success: 'Done' })) });
}

describe('action routes activity log', () => {
  describe('when executing an action', () => {
    it('should record the action, its records and its label', async () => {
      const service = fakeActivityLogsService();
      const { app } = buildApp({ service, client: clientOf(executingAction()) });

      const response = await request(app.callback())
        .post('/agent/v1/users/actions/approve/execute')
        .send({ recordIds: ['42', '43'] });

      expect(response.status).toBe(200);
      expect(service.createMcpActivityLog).toHaveBeenCalledWith({
        forestServerToken: API_KEY_SERVER_TOKEN,
        renderingId: String(RENDERING_ID),
        action: 'action',
        type: 'write',
        collectionName: 'users',
        recordId: undefined,
        recordIds: ['42', '43'],
        label: 'triggered the action "approve"',
      });
    });

    it('should mark the log completed once the action ran', async () => {
      const service = fakeActivityLogsService();
      const { app, activityLogs } = buildApp({ service, client: clientOf(executingAction()) });

      await request(app.callback())
        .post('/agent/v1/users/actions/approve/execute')
        .send({ recordIds: ['42'] });
      await activityLogs.drain();

      expect(service.updateActivityLogStatus).toHaveBeenCalledWith({
        forestServerToken: API_KEY_SERVER_TOKEN,
        activityLog: { id: ACTIVITY_LOG_ID, attributes: { index: ACTIVITY_LOG_INDEX } },
        status: 'completed',
      });
    });

    it('should mark the log failed when the action throws', async () => {
      const service = fakeActivityLogsService();
      const form = makeAction({
        execute: jest.fn(async () => {
          throw new Error('the agent is down');
        }),
      });
      const { app, activityLogs } = buildApp({ service, client: clientOf(form) });

      const response = await request(app.callback())
        .post('/agent/v1/users/actions/approve/execute')
        .send({ recordIds: ['42'] });
      await activityLogs.drain();

      expect(response.status).toBe(502);
      expect(service.updateActivityLogStatus).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed' }),
      );
    });

    it('should mark the log failed when the action cannot even be loaded', async () => {
      const service = fakeActivityLogsService();
      const loadAction = jest.fn(async () => {
        throw new Error('the agent is down');
      });
      const { app, activityLogs } = buildApp({
        service,
        client: clientOf(executingAction(), loadAction as jest.Mock),
      });

      await request(app.callback())
        .post('/agent/v1/users/actions/approve/execute')
        .send({ recordIds: ['42'] });
      await activityLogs.drain();

      expect(service.updateActivityLogStatus).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed' }),
      );
    });

    it('should mark the log completed when the action was routed for approval', async () => {
      const service = fakeActivityLogsService();
      const form = makeAction({
        execute: jest.fn(async () => {
          throw new ActionRequiresApprovalError('Needs approval', [7]);
        }),
      });
      const { app, activityLogs } = buildApp({ service, client: clientOf(form) });

      const response = await request(app.callback())
        .post('/agent/v1/users/actions/approve/execute')
        .send({ recordIds: ['42'] });
      await activityLogs.drain();

      expect(response.status).toBe(403);
      expect(response.body.error.type).toBe('action_requires_approval');
      expect(service.updateActivityLogStatus).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed' }),
      );
    });

    it('should refuse with audit_unavailable and never reach the agent when the log cannot be created', async () => {
      const service = fakeActivityLogsService({
        createMcpActivityLog: jest.fn(async () => {
          throw new Error('the audit store is down');
        }),
      });
      const loadAction = jest.fn(async () => executingAction());
      const { app } = buildApp({
        service,
        client: clientOf(executingAction(), loadAction as jest.Mock),
      });

      const response = await request(app.callback())
        .post('/agent/v1/users/actions/approve/execute')
        .send({ recordIds: ['42'] });

      expect(response.status).toBe(503);
      expect(response.body.error.type).toBe('audit_unavailable');
      expect(response.headers['retry-after']).toBe('5');
      expect(loadAction).not.toHaveBeenCalled();
    });

    it('should refuse with audit_unavailable when the audit endpoint returns no log id', async () => {
      const service = fakeActivityLogsService({
        createMcpActivityLog: jest.fn(async () => ({ attributes: { index: ACTIVITY_LOG_INDEX } })),
      });
      const { app } = buildApp({ service, client: clientOf(executingAction()) });

      const response = await request(app.callback())
        .post('/agent/v1/users/actions/approve/execute')
        .send({ recordIds: ['42'] });

      expect(response.status).toBe(503);
      expect(response.body.error.type).toBe('audit_unavailable');
    });

    it('should refuse with audit_not_authorized when the audit endpoint rejects the identity', async () => {
      const service = fakeActivityLogsService({
        createMcpActivityLog: jest.fn(async () => {
          throw new HttpError('Forbidden', 403);
        }),
      });
      const { app } = buildApp({ service, client: clientOf(executingAction()) });

      const response = await request(app.callback())
        .post('/agent/v1/users/actions/approve/execute')
        .send({ recordIds: ['42'] });

      expect(response.status).toBe(403);
      expect(response.body.error.type).toBe('audit_not_authorized');
    });

    it('should refuse with session_expired when the oauth session cannot be resolved', async () => {
      const service = fakeActivityLogsService();
      const loadAction = jest.fn(async () => executingAction());
      const { app } = buildApp({
        service,
        client: clientOf(executingAction(), loadAction as jest.Mock),
        credentials: oauthCredentials(),
        saasAccessToken: undefined,
      });

      const response = await request(app.callback())
        .post('/agent/v1/users/actions/approve/execute')
        .send({ recordIds: ['42'] });

      expect(response.status).toBe(401);
      expect(response.body.error.type).toBe('session_expired');
      expect(loadAction).not.toHaveBeenCalled();
      expect(service.createMcpActivityLog).not.toHaveBeenCalled();
    });

    it('should use the session token when the caller carries an oauth session', async () => {
      const service = fakeActivityLogsService();
      const saasAccessToken = sessionAccessToken();
      const { app } = buildApp({
        service,
        client: clientOf(executingAction()),
        credentials: oauthCredentials(),
        saasAccessToken,
      });

      await request(app.callback())
        .post('/agent/v1/users/actions/approve/execute')
        .send({ recordIds: ['42'] });

      expect(service.createMcpActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({ forestServerToken: saasAccessToken }),
      );
    });
  });

  describe('when loading an action form', () => {
    it('should write no log', async () => {
      const service = fakeActivityLogsService();
      const { app } = buildApp({ service, client: clientOf(makeAction()) });

      const response = await request(app.callback())
        .post('/agent/v1/users/actions/approve/form')
        .send({ recordIds: ['42'] });

      expect(response.status).toBe(200);
      expect(service.createMcpActivityLog).not.toHaveBeenCalled();
    });
  });
});
