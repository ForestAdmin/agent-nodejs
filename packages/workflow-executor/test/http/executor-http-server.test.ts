import type { WorkflowPort } from '../../src/ports/workflow-port';
import type Runner from '../../src/runner';

import jsonwebtoken from 'jsonwebtoken';
import request from 'supertest';

import {
  InvalidPendingDataError,
  PendingDataNotFoundError,
  RunNotFoundError,
  UserMismatchError,
} from '../../src/errors';
import ExecutorHttpServer from '../../src/http/executor-http-server';

const AUTH_SECRET = 'test-auth-secret';

function signToken(payload: object, secret = AUTH_SECRET, options?: jsonwebtoken.SignOptions) {
  return jsonwebtoken.sign(payload, secret, { expiresIn: '1h', ...options });
}

function createMockRunner(overrides: Partial<Runner> = {}): Runner {
  return {
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    triggerPoll: jest.fn().mockResolvedValue(undefined),
    getRunStepExecutions: jest.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as Runner;
}

function createMockWorkflowPort(overrides: Partial<WorkflowPort> = {}): WorkflowPort {
  return {
    getPendingStepExecutions: jest.fn().mockResolvedValue([]),
    getPendingStepExecutionsForRun: jest.fn(),
    updateStepExecution: jest.fn().mockResolvedValue(undefined),
    getCollectionSchema: jest.fn(),
    getMcpServerConfigs: jest.fn().mockResolvedValue([]),
    hasRunAccess: jest.fn().mockResolvedValue(true),
    ...overrides,
  } as unknown as WorkflowPort;
}

function createServer(
  overrides: {
    runner?: Runner;
    workflowPort?: WorkflowPort;
    logger?: { error: jest.Mock };
  } = {},
) {
  return new ExecutorHttpServer({
    port: 0,
    runner: overrides.runner ?? createMockRunner(),
    authSecret: AUTH_SECRET,
    workflowPort: overrides.workflowPort ?? createMockWorkflowPort(),
    logger: overrides.logger,
  });
}

describe('ExecutorHttpServer', () => {
  describe('JWT authentication', () => {
    it('should return 401 when no token is provided', async () => {
      const server = createServer();

      const response = await request(server.callback).get('/runs/run-1');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Unauthorized' });
    });

    it('should return 401 when token is signed with wrong secret', async () => {
      const server = createServer();
      const token = signToken({ id: 1 }, 'wrong-secret');

      const response = await request(server.callback)
        .get('/runs/run-1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Unauthorized' });
    });

    it('should return 401 when token is expired', async () => {
      const server = createServer();
      const token = signToken({ id: 1 }, AUTH_SECRET, { expiresIn: '0s' });

      // Small delay to ensure token is expired
      await new Promise(resolve => {
        setTimeout(resolve, 10);
      });

      const response = await request(server.callback)
        .get('/runs/run-1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Unauthorized' });
    });

    it('should return 401 when token is malformed', async () => {
      const server = createServer();

      const response = await request(server.callback)
        .get('/runs/run-1')
        .set('Authorization', 'Bearer not-a-jwt');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Unauthorized' });
    });

    it('should accept valid token in Authorization header', async () => {
      const server = createServer();
      const token = signToken({ id: 1 });

      const response = await request(server.callback)
        .get('/runs/run-1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
    });

    it('should accept valid token in forest_session_token cookie', async () => {
      const server = createServer();
      const token = signToken({ id: 1 });

      const response = await request(server.callback)
        .get('/runs/run-1')
        .set('Cookie', `forest_session_token=${token}`);

      expect(response.status).toBe(200);
    });

    it('should populate ctx.state.user with the decoded JWT payload', async () => {
      let capturedUser: unknown;

      // Build a thin Koa app with the same JWT config to prove user extraction
      const Koa = (await import('koa')).default;
      const koaJwt = (await import('koa-jwt')).default;
      const app = new Koa();
      app.use(koaJwt({ secret: AUTH_SECRET, cookie: 'forest_session_token' }));
      app.use(async ctx => {
        capturedUser = ctx.state.user;
        ctx.body = { ok: true };
      });

      const token = signToken({
        id: 'user-42',
        email: 'admin@forest.com',
        firstName: 'Ada',
      });

      await request(app.callback()).get('/').set('Authorization', `Bearer ${token}`);

      expect(capturedUser).toEqual(
        expect.objectContaining({ id: 'user-42', email: 'admin@forest.com', firstName: 'Ada' }),
      );
    });
  });

  describe('run access authorization', () => {
    it('returns 403 when hasRunAccess returns false on GET /runs/:runId', async () => {
      const workflowPort = createMockWorkflowPort({
        hasRunAccess: jest.fn().mockResolvedValue(false),
      });
      const server = createServer({ workflowPort });
      const token = signToken({ id: 1 });

      const response = await request(server.callback)
        .get('/runs/run-1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'Forbidden' });
    });

    it('calls hasRunAccess with the correct runId and userToken', async () => {
      const workflowPort = createMockWorkflowPort();
      const server = createServer({ workflowPort });
      const token = signToken({ id: 1 });

      const response = await request(server.callback)
        .get('/runs/run-42')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(workflowPort.hasRunAccess).toHaveBeenCalledWith('run-42', token);
    });

    it('calls hasRunAccess with token from cookie', async () => {
      const workflowPort = createMockWorkflowPort();
      const server = createServer({ workflowPort });
      const token = signToken({ id: 1 });

      const response = await request(server.callback)
        .get('/runs/run-cookie')
        .set('Cookie', `forest_session_token=${token}`);

      expect(response.status).toBe(200);
      expect(workflowPort.hasRunAccess).toHaveBeenCalledWith('run-cookie', token);
    });

    it('returns 503 when hasRunAccess throws', async () => {
      const logger = { error: jest.fn() };
      const workflowPort = createMockWorkflowPort({
        hasRunAccess: jest.fn().mockRejectedValue(new Error('orchestrator down')),
      });
      const server = createServer({ workflowPort, logger });
      const token = signToken({ id: 1 });

      const response = await request(server.callback)
        .get('/runs/run-1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(503);
      expect(response.body).toEqual({ error: 'Service unavailable' });
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to check run access',
        expect.objectContaining({ runId: 'run-1', error: 'orchestrator down' }),
      );
    });

    it('does not call getRunStepExecutions when hasRunAccess returns false', async () => {
      const runner = createMockRunner();
      const workflowPort = createMockWorkflowPort({
        hasRunAccess: jest.fn().mockResolvedValue(false),
      });
      const server = createServer({ runner, workflowPort });
      const token = signToken({ id: 1 });

      await request(server.callback).get('/runs/run-1').set('Authorization', `Bearer ${token}`);

      expect(runner.getRunStepExecutions).not.toHaveBeenCalled();
    });
  });

  describe('GET /runs/:runId', () => {
    it('should return steps from the runner', async () => {
      const steps = [{ type: 'condition' as const, stepIndex: 0 }];

      const runner = createMockRunner({
        getRunStepExecutions: jest.fn().mockResolvedValue(steps),
      });

      const server = createServer({ runner });
      const token = signToken({ id: 1 });

      const response = await request(server.callback)
        .get('/runs/run-1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ steps });
      expect(runner.getRunStepExecutions).toHaveBeenCalledWith('run-1');
    });

    it('should return 500 when getRunStepExecutions rejects', async () => {
      const runner = createMockRunner({
        getRunStepExecutions: jest.fn().mockRejectedValue(new Error('db error')),
      });

      const server = createServer({ runner });
      const token = signToken({ id: 1 });

      const response = await request(server.callback)
        .get('/runs/run-1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('POST /runs/:runId/trigger', () => {
    it('should call runner.triggerPoll with runId and options', async () => {
      const runner = createMockRunner();
      const server = createServer({ runner });
      const token = signToken({ id: 1 });

      const response = await request(server.callback)
        .post('/runs/run-1/trigger')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ triggered: true });
      expect(runner.triggerPoll).toHaveBeenCalledWith('run-1', {
        pendingData: undefined,
        bearerUserId: 1,
      });
    });

    it('passes pendingData from request body to runner.triggerPoll', async () => {
      const runner = createMockRunner();
      const server = createServer({ runner });
      const token = signToken({ id: 1 });

      const response = await request(server.callback)
        .post('/runs/run-1/trigger')
        .set('Authorization', `Bearer ${token}`)
        .send({ pendingData: { userConfirmed: true } });

      expect(response.status).toBe(200);
      expect(runner.triggerPoll).toHaveBeenCalledWith('run-1', {
        pendingData: { userConfirmed: true },
        bearerUserId: 1,
      });
    });

    it('returns 404 when triggerPoll rejects with RunNotFoundError', async () => {
      const runner = createMockRunner({
        triggerPoll: jest.fn().mockRejectedValue(new RunNotFoundError('run-1')),
      });

      const server = createServer({ runner });
      const token = signToken({ id: 1 });

      const response = await request(server.callback)
        .post('/runs/run-1/trigger')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Run not found or unavailable' });
    });

    it('returns 403 when triggerPoll rejects with UserMismatchError', async () => {
      const runner = createMockRunner({
        triggerPoll: jest.fn().mockRejectedValue(new UserMismatchError('run-1')),
      });

      const server = createServer({ runner });
      const token = signToken({ id: 1 });

      const response = await request(server.callback)
        .post('/runs/run-1/trigger')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'Forbidden' });
    });

    it('returns 404 when triggerPoll rejects with PendingDataNotFoundError', async () => {
      const runner = createMockRunner({
        triggerPoll: jest.fn().mockRejectedValue(new PendingDataNotFoundError('run-1', 0)),
      });

      const server = createServer({ runner });
      const token = signToken({ id: 1 });

      const response = await request(server.callback)
        .post('/runs/run-1/trigger')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Step execution not found or has no pending data' });
    });

    it('returns 400 when triggerPoll rejects with InvalidPendingDataError', async () => {
      const issues = [
        { path: ['userConfirmed'], message: 'Expected boolean', code: 'invalid_type' },
      ];
      const runner = createMockRunner({
        triggerPoll: jest.fn().mockRejectedValue(new InvalidPendingDataError(issues)),
      });

      const server = createServer({ runner });
      const token = signToken({ id: 1 });

      const response = await request(server.callback)
        .post('/runs/run-1/trigger')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid request body', details: issues });
    });

    it('returns 500 when triggerPoll rejects with an unexpected error', async () => {
      const runner = createMockRunner({
        triggerPoll: jest.fn().mockRejectedValue(new Error('unexpected')),
      });

      const server = createServer({ runner });
      const token = signToken({ id: 1 });

      const response = await request(server.callback)
        .post('/runs/run-1/trigger')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('start / stop', () => {
    it('should start and stop the server', async () => {
      const server = createServer();

      await server.start();
      await expect(server.stop()).resolves.toBeUndefined();
    });

    it('should handle stop when not started', async () => {
      const server = createServer();

      await expect(server.stop()).resolves.toBeUndefined();
    });
  });
});
