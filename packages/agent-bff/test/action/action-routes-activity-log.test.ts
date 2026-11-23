import type { AgentTransport } from '../../src/agent/agent-transport';
import type { Logger } from '../../src/ports/logger-port';
import type { HttpRequester } from '@forestadmin/agent-client';
import type { Middleware } from 'koa';

import { AgentHttpError, drainActivityLogs } from '@forestadmin/agent-client';
import { HttpError } from '@forestadmin/forestadmin-client';
import { bodyParser } from '@koa/bodyparser';
import Koa from 'koa';
import request from 'supertest';

import createActionRoutesMiddleware from '../../src/action/action-routes-middleware';
import createErrorMiddleware from '../../src/http/error-middleware';
import { TIMEZONE, readModel, storeOf } from '../helpers/action-routes';
import {
  ACTIVITY_LOG_ID,
  ACTIVITY_LOG_INDEX,
  API_KEY_SERVER_TOKEN,
  RENDERING_ID,
  apiKeyCredentials,
  fakeActivityLogsService,
  forestServerTokenStep,
  oauthCredentials,
  sessionAccessToken,
} from '../helpers/activity-log';

const noopLogger: Logger = () => undefined;

function agentAnswering(answer: () => Promise<unknown> = async () => ({ success: 'Done' })) {
  return jest.fn(answer);
}

function transportTo(agent: jest.Mock): AgentTransport {
  return {
    url: 'https://agent.example.com',
    createRequester: () => ({ query: agent } as unknown as HttpRequester),
  };
}

function buildApp({
  service,
  agent = agentAnswering(),
  credentials = apiKeyCredentials(),
  saasAccessToken,
}: {
  service: ReturnType<typeof fakeActivityLogsService>;
  agent?: jest.Mock;
  credentials?: Middleware;
  saasAccessToken?: string;
}): Koa {
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
      transport: transportTo(agent),
      logger: noopLogger,
      activityLogsService: service,
    }),
  );

  return app;
}

describe('action routes activity log', () => {
  describe('when executing an action', () => {
    it('should record the action, its records and its label', async () => {
      const service = fakeActivityLogsService();

      const response = await request(buildApp({ service }).callback())
        .post('/agent/v1/users/actions/approve/execute')
        .send({ recordIds: ['42', '43'] });

      expect(response.status).toBe(200);
      expect(service.createMcpActivityLog).toHaveBeenCalledWith({
        forestServerToken: API_KEY_SERVER_TOKEN,
        renderingId: String(RENDERING_ID),
        action: 'action',
        type: 'write',
        collectionName: 'users',
        recordIds: ['42', '43'],
        label: 'triggered the action "approve"',
      });
    });

    it('should record an attempt on an action the read model does not expose', async () => {
      const service = fakeActivityLogsService();
      const agent = agentAnswering();

      const response = await request(buildApp({ service, agent }).callback())
        .post('/agent/v1/users/actions/ghost/execute')
        .send({ recordIds: ['42'] });

      expect(response.status).toBe(404);
      expect(agent).not.toHaveBeenCalled();
      expect(service.createMcpActivityLog).toHaveBeenCalledWith({
        forestServerToken: API_KEY_SERVER_TOKEN,
        renderingId: String(RENDERING_ID),
        action: 'action',
        type: 'write',
        collectionName: 'users',
        recordIds: ['42'],
        label: 'triggered the action "ghost"',
      });
    });

    it('should mark that attempt failed', async () => {
      const service = fakeActivityLogsService();

      await request(buildApp({ service }).callback())
        .post('/agent/v1/users/actions/ghost/execute')
        .send({ recordIds: ['42'] });
      await drainActivityLogs();

      expect(service.updateActivityLogStatus).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed' }),
      );
    });

    it('should leave the form of an unexposed action unaudited, like every other form', async () => {
      const service = fakeActivityLogsService();

      const response = await request(buildApp({ service }).callback())
        .post('/agent/v1/users/actions/ghost/form')
        .send({ recordIds: ['42'] });

      expect(response.status).toBe(404);
      expect(service.createMcpActivityLog).not.toHaveBeenCalled();
    });

    it('should mark the log completed once the action ran', async () => {
      const service = fakeActivityLogsService();

      await request(buildApp({ service }).callback())
        .post('/agent/v1/users/actions/approve/execute')
        .send({ recordIds: ['42'] });
      await drainActivityLogs();

      expect(service.updateActivityLogStatus).toHaveBeenCalledWith({
        forestServerToken: API_KEY_SERVER_TOKEN,
        activityLog: { id: ACTIVITY_LOG_ID, attributes: { index: ACTIVITY_LOG_INDEX } },
        status: 'completed',
      });
    });

    it('should mark the log failed when the action throws', async () => {
      const service = fakeActivityLogsService();
      const agent = agentAnswering(async () => {
        throw new Error('the agent is down');
      });

      const response = await request(buildApp({ service, agent }).callback())
        .post('/agent/v1/users/actions/approve/execute')
        .send({ recordIds: ['42'] });
      await drainActivityLogs();

      expect(response.status).toBe(502);
      expect(service.updateActivityLogStatus).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed' }),
      );
    });

    it('should mark the log failed when a value names no field of the form', async () => {
      const service = fakeActivityLogsService();
      const agent = agentAnswering();

      const response = await request(buildApp({ service, agent }).callback())
        .post('/agent/v1/users/actions/approve/execute')
        .send({ recordIds: ['42'], values: { ghost: 1 } });
      await drainActivityLogs();

      expect(response.status).toBe(400);
      expect(agent).not.toHaveBeenCalled();
      expect(service.updateActivityLogStatus).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed' }),
      );
    });

    it('should mark the log canceled when the action needs an approval', async () => {
      const service = fakeActivityLogsService();
      const agent = agentAnswering(async () => {
        throw new AgentHttpError(403, {
          errors: [{ name: 'CustomActionRequiresApprovalError', detail: 'Needs approval' }],
        });
      });

      const response = await request(buildApp({ service, agent }).callback())
        .post('/agent/v1/users/actions/approve/execute')
        .send({ recordIds: ['42'] });
      await drainActivityLogs();

      expect(response.status).toBe(403);
      expect(response.body.error.type).toBe('action_requires_approval');
      expect(service.updateActivityLogStatus).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'canceled' }),
      );
    });

    it('should refuse with audit_unavailable and never reach the agent when the log cannot be created', async () => {
      const service = fakeActivityLogsService({
        createMcpActivityLog: jest.fn(async () => {
          throw new Error('the audit store is down');
        }),
      });
      const agent = agentAnswering();

      const response = await request(buildApp({ service, agent }).callback())
        .post('/agent/v1/users/actions/approve/execute')
        .send({ recordIds: ['42'] });

      expect(response.status).toBe(503);
      expect(response.body.error.type).toBe('audit_unavailable');
      expect(response.headers['retry-after']).toBe('5');
      expect(agent).not.toHaveBeenCalled();
    });

    it('should refuse without a retry hint when the server exposes no activity log endpoint', async () => {
      const service = fakeActivityLogsService({
        createMcpActivityLog: jest.fn(async () => {
          throw new HttpError('not implemented', 501);
        }),
      });

      const response = await request(buildApp({ service }).callback())
        .post('/agent/v1/users/actions/approve/execute')
        .send({ recordIds: ['42'] });

      expect(response.status).toBe(503);
      expect(response.body.error.type).toBe('audit_unavailable');
      expect(response.headers['retry-after']).toBeUndefined();
    });

    it('should refuse with audit_unavailable when the audit endpoint returns no log id', async () => {
      const service = fakeActivityLogsService({
        createMcpActivityLog: jest.fn(async () => ({ attributes: { index: ACTIVITY_LOG_INDEX } })),
      });

      const response = await request(buildApp({ service }).callback())
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

      const response = await request(buildApp({ service }).callback())
        .post('/agent/v1/users/actions/approve/execute')
        .send({ recordIds: ['42'] });

      expect(response.status).toBe(403);
      expect(response.body.error.type).toBe('audit_not_authorized');
    });

    it('should refuse with session_expired when the oauth session cannot be resolved', async () => {
      const service = fakeActivityLogsService();
      const agent = agentAnswering();

      const response = await request(
        buildApp({
          service,
          agent,
          credentials: oauthCredentials(),
          saasAccessToken: undefined,
        }).callback(),
      )
        .post('/agent/v1/users/actions/approve/execute')
        .send({ recordIds: ['42'] });

      expect(response.status).toBe(401);
      expect(response.body.error.type).toBe('session_expired');
      expect(agent).not.toHaveBeenCalled();
      expect(service.createMcpActivityLog).not.toHaveBeenCalled();
    });

    it('should use the session token when the caller carries an oauth session', async () => {
      const service = fakeActivityLogsService();
      const saasAccessToken = sessionAccessToken();

      await request(
        buildApp({ service, credentials: oauthCredentials(), saasAccessToken }).callback(),
      )
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

      const response = await request(buildApp({ service }).callback())
        .post('/agent/v1/users/actions/approve/form')
        .send({ recordIds: ['42'] });

      expect(response.status).toBe(200);
      expect(service.createMcpActivityLog).not.toHaveBeenCalled();
    });
  });
});
