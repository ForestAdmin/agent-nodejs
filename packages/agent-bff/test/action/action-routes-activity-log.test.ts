import type { AgentTransport } from '../../src/agent/agent-transport';
import type { Logger } from '../../src/ports/logger-port';
import type { Middleware } from 'koa';

import {
  AGENT_DISPATCH_TIMEOUT_CODE,
  AgentHttpError,
  AgentTimeoutError,
  drainActivityLogs,
} from '@forestadmin/agent-client';
import { ActivityLogsService, HttpError, ServerUtils } from '@forestadmin/forestadmin-client';
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

const FOREST_SERVER_URL = 'https://api.forestadmin.com';

jest.mock('@forestadmin/forestadmin-client', () => ({
  ...jest.requireActual('@forestadmin/forestadmin-client'),
  ActivityLogsService: jest.fn(),
}));

const noopLogger: Logger = () => undefined;

function agentAnswering(answer: () => Promise<unknown> = async () => ({ success: 'Done' })) {
  return jest.fn(answer);
}

function transportTo(agent: jest.Mock): AgentTransport {
  return {
    url: 'https://agent.example.com',
    dispatcher: {
      request: async dispatched => {
        try {
          return { status: 200, body: await agent(dispatched) };
        } catch (error) {
          if (error instanceof AgentHttpError) {
            return { status: error.status, body: error.body, text: error.responseText };
          }

          if (error instanceof AgentTimeoutError) {
            throw Object.assign(new Error(error.message), { code: AGENT_DISPATCH_TIMEOUT_CODE });
          }

          throw error;
        }
      },
    },
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
  (ActivityLogsService as jest.Mock).mockImplementation(() => service);
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
      forestServerUrl: FOREST_SERVER_URL,
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

    it('should load a form without resolving what the activity log of an execute needs', async () => {
      const service = fakeActivityLogsService();

      const withoutRendering: Middleware = async (ctx, next) => {
        ctx.state.authMode = 'api-key';
        await next();
      };

      (ActivityLogsService as jest.Mock).mockClear();

      const response = await request(
        buildApp({ service, credentials: withoutRendering }).callback(),
      )
        .post('/agent/v1/users/actions/approve/form')
        .send({ recordIds: ['42'] });

      expect(response.status).toBe(200);
      expect(ActivityLogsService).not.toHaveBeenCalled();
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
        throw new AgentHttpError(500, {}, 'Internal Server Error');
      });

      const response = await request(buildApp({ service, agent }).callback())
        .post('/agent/v1/users/actions/approve/execute')
        .send({ recordIds: ['42'] });
      await drainActivityLogs();

      expect(response.status).toBe(503);
      expect(service.updateActivityLogStatus).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed' }),
      );
    });

    describe('when the execute gets no answer', () => {
      it.each([
        ['a timeout', new AgentTimeoutError('Timeout of 30000ms exceeded')],
        ['a gateway 502', new AgentHttpError(502, null, '<html>Bad Gateway</html>')],
      ])(
        'should leave the log pending on %s, since the action may still have run',
        async (_, cause) => {
          const service = fakeActivityLogsService();
          const agent = agentAnswering(async () => {
            throw cause;
          });

          const response = await request(buildApp({ service, agent }).callback())
            .post('/agent/v1/users/actions/approve/execute')
            .send({ recordIds: ['42'] });
          await drainActivityLogs();

          expect(response.status).toBe(504);
          expect(response.body.error).toMatchObject({ details: { outcome: 'unknown' } });
          expect(service.createMcpActivityLog).toHaveBeenCalledTimes(1);
          expect(service.updateActivityLogStatus).not.toHaveBeenCalled();
        },
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

  describe('when the action needs an approval', () => {
    const forestServer = jest.spyOn(ServerUtils, 'queryWithBearerToken');
    const approvalGated = () =>
      agentAnswering(async () => {
        throw new AgentHttpError(403, {
          errors: [{ name: 'CustomActionRequiresApprovalError', detail: 'Needs approval' }],
        });
      });

    beforeEach(() => {
      forestServer.mockReset();
      forestServer.mockResolvedValue({ data: { id: 'req_42' } });
    });

    afterAll(() => forestServer.mockRestore());

    const approvalRequestOf = (bearerToken: string) =>
      expect.objectContaining({
        forestServerUrl: FOREST_SERVER_URL,
        method: 'post',
        path: '/api/action-approvals',
        bearerToken,
        headers: {
          'forest-rendering-id': String(RENDERING_ID),
          'Forest-Application-Source': 'BFF',
        },
      });

    it('should file the approval request with the api key server token and answer 202 with its id', async () => {
      const service = fakeActivityLogsService();

      const response = await request(buildApp({ service, agent: approvalGated() }).callback())
        .post('/agent/v1/users/actions/approve/execute')
        .send({ recordIds: ['42'] });

      expect(response.status).toBe(202);
      expect(response.body).toEqual({
        type: 'approval_requested',
        approvalRequest: { id: 'req_42' },
      });
      expect(forestServer).toHaveBeenCalledWith(approvalRequestOf(API_KEY_SERVER_TOKEN));
    });

    it('should cancel the action entry and record the approval request as a createApproval entry', async () => {
      const service = fakeActivityLogsService({
        createMcpActivityLog: jest.fn(async ({ action }: { action: string }) => ({
          id: `log-of-${action}`,
          attributes: { index: ACTIVITY_LOG_INDEX },
        })),
      });

      await request(buildApp({ service, agent: approvalGated() }).callback())
        .post('/agent/v1/users/actions/approve/execute')
        .send({ recordIds: ['42'] });
      await drainActivityLogs();

      expect(service.createMcpActivityLog).toHaveBeenCalledTimes(2);
      expect(service.createMcpActivityLog).toHaveBeenLastCalledWith({
        forestServerToken: API_KEY_SERVER_TOKEN,
        renderingId: String(RENDERING_ID),
        action: 'createApproval',
        type: 'write',
        collectionName: 'users',
        recordIds: ['42'],
        label: 'requested an approval for the action "approve"',
      });
      expect(service.updateActivityLogStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          activityLog: expect.objectContaining({ id: 'log-of-action' }),
          status: 'canceled',
        }),
      );
      expect(service.updateActivityLogStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          activityLog: expect.objectContaining({ id: 'log-of-createApproval' }),
          status: 'completed',
        }),
      );
    });

    it('should file the approval request with the session server token under OAuth', async () => {
      const service = fakeActivityLogsService();
      const saasAccessToken = sessionAccessToken();

      const response = await request(
        buildApp({
          service,
          agent: approvalGated(),
          credentials: oauthCredentials(),
          saasAccessToken,
        }).callback(),
      )
        .post('/agent/v1/users/actions/approve/execute')
        .send({ recordIds: ['42'] });

      expect(response.status).toBe(202);
      expect(response.body.approvalRequest).toEqual({ id: 'req_42' });
      expect(forestServer).toHaveBeenCalledWith(approvalRequestOf(saasAccessToken));
    });

    it('should post the approval request message as the comment of the request', async () => {
      const service = fakeActivityLogsService();

      await request(buildApp({ service, agent: approvalGated() }).callback())
        .post('/agent/v1/users/actions/approve/execute')
        .send({ recordIds: ['42'], approvalRequestMessage: 'Refund a duplicate payment' });

      expect(forestServer).toHaveBeenLastCalledWith(
        expect.objectContaining({
          path: '/api/action-approvals/req_42/comments',
          body: { data: { attributes: { comment: 'Refund a duplicate payment' } } },
        }),
      );
    });

    it('should mark the log canceled', async () => {
      const service = fakeActivityLogsService();

      await request(buildApp({ service, agent: approvalGated() }).callback())
        .post('/agent/v1/users/actions/approve/execute')
        .send({ recordIds: ['42'] });
      await drainActivityLogs();

      expect(service.updateActivityLogStatus).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'canceled' }),
      );
    });

    it('should answer 503 approval_request_failed when the request cannot be filed, and not run the action', async () => {
      forestServer.mockRejectedValue(new HttpError('refused', 500));
      const service = fakeActivityLogsService();
      const agent = approvalGated();

      const response = await request(buildApp({ service, agent }).callback())
        .post('/agent/v1/users/actions/approve/execute')
        .send({ recordIds: ['42'] });
      await drainActivityLogs();

      expect(response.status).toBe(503);
      expect(response.body.error.type).toBe('approval_request_failed');
      expect(agent).toHaveBeenCalledTimes(1);
      expect(service.updateActivityLogStatus).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'canceled' }),
      );
    });
  });
});
