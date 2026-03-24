import type { RunStore } from '../../src/ports/run-store';
import type { WorkflowPort } from '../../src/ports/workflow-port';
import type Runner from '../../src/runner';

import jsonwebtoken from 'jsonwebtoken';
import request from 'supertest';

import { RunNotFoundError } from '../../src/errors';
import ExecutorHttpServer from '../../src/http/executor-http-server';

const AUTH_SECRET = 'test-auth-secret';

function signToken(payload: object, secret = AUTH_SECRET, options?: jsonwebtoken.SignOptions) {
  return jsonwebtoken.sign(payload, secret, { expiresIn: '1h', ...options });
}

function createMockRunStore(overrides: Partial<RunStore> = {}): RunStore {
  return {
    init: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    getStepExecutions: jest.fn().mockResolvedValue([]),
    saveStepExecution: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createMockRunner(overrides: Partial<Runner> = {}): Runner {
  return {
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    triggerPoll: jest.fn().mockResolvedValue(undefined),
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
    runStore?: RunStore;
    runner?: Runner;
    workflowPort?: WorkflowPort;
    logger?: { error: jest.Mock };
  } = {},
) {
  return new ExecutorHttpServer({
    port: 0,
    runStore: overrides.runStore ?? createMockRunStore(),
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
      const token = signToken({ id: 'user-1' }, 'wrong-secret');

      const response = await request(server.callback)
        .get('/runs/run-1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Unauthorized' });
    });

    it('should return 401 when token is expired', async () => {
      const server = createServer();
      const token = signToken({ id: 'user-1' }, AUTH_SECRET, { expiresIn: '0s' });

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
      const token = signToken({ id: 'user-1' });

      const response = await request(server.callback)
        .get('/runs/run-1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
    });

    it('should accept valid token in forest_session_token cookie', async () => {
      const server = createServer();
      const token = signToken({ id: 'user-1' });

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
      const token = signToken({ id: 'user-1' });

      const response = await request(server.callback)
        .get('/runs/run-1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'Forbidden' });
    });

    it('returns 403 when hasRunAccess returns false on POST /runs/:runId/trigger', async () => {
      const workflowPort = createMockWorkflowPort({
        hasRunAccess: jest.fn().mockResolvedValue(false),
      });
      const server = createServer({ workflowPort });
      const token = signToken({ id: 'user-1' });

      const response = await request(server.callback)
        .post('/runs/run-1/trigger')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'Forbidden' });
    });

    it('calls hasRunAccess with the correct runId and userToken', async () => {
      const workflowPort = createMockWorkflowPort();
      const server = createServer({ workflowPort });
      const token = signToken({ id: 'user-1' });

      const response = await request(server.callback)
        .get('/runs/run-42')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(workflowPort.hasRunAccess).toHaveBeenCalledWith('run-42', token);
    });

    it('calls hasRunAccess with token from cookie', async () => {
      const workflowPort = createMockWorkflowPort();
      const server = createServer({ workflowPort });
      const token = signToken({ id: 'user-1' });

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
      const token = signToken({ id: 'user-1' });

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

    it('does not call getStepExecutions when hasRunAccess returns false', async () => {
      const runStore = createMockRunStore();
      const workflowPort = createMockWorkflowPort({
        hasRunAccess: jest.fn().mockResolvedValue(false),
      });
      const server = createServer({ runStore, workflowPort });
      const token = signToken({ id: 'user-1' });

      await request(server.callback).get('/runs/run-1').set('Authorization', `Bearer ${token}`);

      expect(runStore.getStepExecutions).not.toHaveBeenCalled();
    });

    it('does not call triggerPoll when hasRunAccess returns false', async () => {
      const runner = createMockRunner();
      const workflowPort = createMockWorkflowPort({
        hasRunAccess: jest.fn().mockResolvedValue(false),
      });
      const server = createServer({ runner, workflowPort });
      const token = signToken({ id: 'user-1' });

      await request(server.callback)
        .post('/runs/run-1/trigger')
        .set('Authorization', `Bearer ${token}`);

      expect(runner.triggerPoll).not.toHaveBeenCalled();
    });
  });

  describe('GET /runs/:runId', () => {
    it('should return steps from the run store', async () => {
      const steps = [{ type: 'condition' as const, stepIndex: 0 }];

      const runStore = createMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue(steps),
      });

      const server = createServer({ runStore });
      const token = signToken({ id: 'user-1' });

      const response = await request(server.callback)
        .get('/runs/run-1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ steps });
      expect(runStore.getStepExecutions).toHaveBeenCalledWith('run-1');
    });

    it('should return 500 when getStepExecutions rejects', async () => {
      const runStore = createMockRunStore({
        getStepExecutions: jest.fn().mockRejectedValue(new Error('db error')),
      });

      const server = createServer({ runStore });
      const token = signToken({ id: 'user-1' });

      const response = await request(server.callback)
        .get('/runs/run-1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('POST /runs/:runId/trigger', () => {
    it('should call runner.triggerPoll with the runId', async () => {
      const runner = createMockRunner();
      const server = createServer({ runner });
      const token = signToken({ id: 'user-1' });

      const response = await request(server.callback)
        .post('/runs/run-1/trigger')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ triggered: true });
      expect(runner.triggerPoll).toHaveBeenCalledWith('run-1');
    });

    it('returns 404 when triggerPoll rejects with RunNotFoundError', async () => {
      const runner = createMockRunner({
        triggerPoll: jest.fn().mockRejectedValue(new RunNotFoundError('run-1')),
      });

      const server = createServer({ runner });
      const token = signToken({ id: 'user-1' });

      const response = await request(server.callback)
        .post('/runs/run-1/trigger')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Run not found or unavailable' });
    });

    it('returns 500 when triggerPoll rejects with an unexpected error', async () => {
      const runner = createMockRunner({
        triggerPoll: jest.fn().mockRejectedValue(new Error('unexpected')),
      });

      const server = createServer({ runner });
      const token = signToken({ id: 'user-1' });

      const response = await request(server.callback)
        .post('/runs/run-1/trigger')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('PATCH /runs/:runId/steps/:stepIndex/pending-data', () => {
    it('returns 204 and merges userConfirmed:true into pendingData', async () => {
      const existing = {
        type: 'update-record' as const,
        stepIndex: 2,
        pendingData: { fieldName: 'status', value: 'active' },
      };
      const runStore = createMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([existing]),
        saveStepExecution: jest.fn().mockResolvedValue(undefined),
      });
      const server = createServer({ runStore });
      const token = signToken({ id: 'user-1' });

      const response = await request(server.callback)
        .patch('/runs/run-1/steps/2/pending-data')
        .set('Authorization', `Bearer ${token}`)
        .send({ userConfirmed: true });

      expect(response.status).toBe(204);
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          pendingData: { fieldName: 'status', value: 'active', userConfirmed: true },
        }),
      );
    });

    it('returns 204 and merges userConfirmed:false into pendingData', async () => {
      const existing = {
        type: 'trigger-action' as const,
        stepIndex: 0,
        pendingData: { name: 'send_email', displayName: 'Send Email' },
      };
      const runStore = createMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([existing]),
        saveStepExecution: jest.fn().mockResolvedValue(undefined),
      });
      const server = createServer({ runStore });
      const token = signToken({ id: 'user-1' });

      const response = await request(server.callback)
        .patch('/runs/run-1/steps/0/pending-data')
        .set('Authorization', `Bearer ${token}`)
        .send({ userConfirmed: false });

      expect(response.status).toBe(204);
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          pendingData: { name: 'send_email', displayName: 'Send Email', userConfirmed: false },
        }),
      );
    });

    it('returns 404 when step execution does not exist', async () => {
      const runStore = createMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([]),
      });
      const server = createServer({ runStore });
      const token = signToken({ id: 'user-1' });

      const response = await request(server.callback)
        .patch('/runs/run-1/steps/0/pending-data')
        .set('Authorization', `Bearer ${token}`)
        .send({ userConfirmed: true });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Step execution not found or has no pending data' });
    });

    it('returns 404 when step type does not support pending-data confirmation', async () => {
      const existing = { type: 'condition' as const, stepIndex: 1 };
      const runStore = createMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([existing]),
      });
      const server = createServer({ runStore });
      const token = signToken({ id: 'user-1' });

      const response = await request(server.callback)
        .patch('/runs/run-1/steps/1/pending-data')
        .set('Authorization', `Bearer ${token}`)
        .send({ userConfirmed: true });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Step execution not found or has no pending data' });
    });

    it('returns 400 when stepIndex is not a valid integer', async () => {
      const server = createServer();
      const token = signToken({ id: 'user-1' });

      const response = await request(server.callback)
        .patch('/runs/run-1/steps/abc/pending-data')
        .set('Authorization', `Bearer ${token}`)
        .send({ userConfirmed: true });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid stepIndex' });
    });

    it('returns 400 when body contains unknown fields', async () => {
      const existing = {
        type: 'update-record' as const,
        stepIndex: 0,
        pendingData: { name: 'status', displayName: 'Status', value: 'active' },
      };
      const runStore = createMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([existing]),
      });
      const server = createServer({ runStore });
      const token = signToken({ id: 'user-1' });

      const response = await request(server.callback)
        .patch('/runs/run-1/steps/0/pending-data')
        .set('Authorization', `Bearer ${token}`)
        .send({ userConfirmed: true, extra: 'injection' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual(expect.objectContaining({ error: 'Invalid request body' }));
    });

    it('returns 400 when userConfirmed is not a boolean', async () => {
      const existing = {
        type: 'update-record' as const,
        stepIndex: 0,
        pendingData: { name: 'status', displayName: 'Status', value: 'active' },
      };
      const runStore = createMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([existing]),
      });
      const server = createServer({ runStore });
      const token = signToken({ id: 'user-1' });

      const response = await request(server.callback)
        .patch('/runs/run-1/steps/0/pending-data')
        .set('Authorization', `Bearer ${token}`)
        .send({ userConfirmed: 'yes' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual(expect.objectContaining({ error: 'Invalid request body' }));
    });

    it('update-record: accepts value override', async () => {
      const existing = {
        type: 'update-record' as const,
        stepIndex: 0,
        pendingData: { fieldName: 'status', value: 'old_value' },
      };
      const runStore = createMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([existing]),
        saveStepExecution: jest.fn().mockResolvedValue(undefined),
      });
      const server = createServer({ runStore });
      const token = signToken({ id: 'user-1' });

      const response = await request(server.callback)
        .patch('/runs/run-1/steps/0/pending-data')
        .set('Authorization', `Bearer ${token}`)
        .send({ userConfirmed: true, value: 'new_value' });

      expect(response.status).toBe(204);
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          pendingData: expect.objectContaining({ value: 'new_value', userConfirmed: true }),
        }),
      );
    });

    it('update-record: rejects unknown field', async () => {
      const existing = {
        type: 'update-record' as const,
        stepIndex: 0,
        pendingData: { fieldName: 'status', value: 'active' },
      };
      const runStore = createMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([existing]),
      });
      const server = createServer({ runStore });
      const token = signToken({ id: 'user-1' });

      const response = await request(server.callback)
        .patch('/runs/run-1/steps/0/pending-data')
        .set('Authorization', `Bearer ${token}`)
        .send({ userConfirmed: true, name: 'hack' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual(expect.objectContaining({ error: 'Invalid request body' }));
    });

    it('load-related-record: accepts selectedRecordId override', async () => {
      const existing = {
        type: 'load-related-record' as const,
        stepIndex: 1,
        pendingData: {
          name: 'order',
          displayName: 'Order',
          selectedRecordId: [99],
          suggestedFields: [],
        },
        selectedRecordRef: { collectionName: 'customers', recordId: [42], stepIndex: 0 },
      };
      const runStore = createMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([existing]),
        saveStepExecution: jest.fn().mockResolvedValue(undefined),
      });
      const server = createServer({ runStore });
      const token = signToken({ id: 'user-1' });

      const response = await request(server.callback)
        .patch('/runs/run-1/steps/1/pending-data')
        .set('Authorization', `Bearer ${token}`)
        .send({ userConfirmed: true, selectedRecordId: ['42'] });

      expect(response.status).toBe(204);
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          pendingData: expect.objectContaining({ selectedRecordId: ['42'], userConfirmed: true }),
        }),
      );
    });

    it('load-related-record: accepts relation override (name + displayName)', async () => {
      const existing = {
        type: 'load-related-record' as const,
        stepIndex: 1,
        pendingData: {
          name: 'order',
          displayName: 'Order',
          selectedRecordId: [99],
          suggestedFields: [],
        },
        selectedRecordRef: { collectionName: 'customers', recordId: [42], stepIndex: 0 },
      };
      const runStore = createMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([existing]),
        saveStepExecution: jest.fn().mockResolvedValue(undefined),
      });
      const server = createServer({ runStore });
      const token = signToken({ id: 'user-1' });

      const response = await request(server.callback)
        .patch('/runs/run-1/steps/1/pending-data')
        .set('Authorization', `Bearer ${token}`)
        .send({ userConfirmed: true, name: 'orders', displayName: 'Orders' });

      expect(response.status).toBe(204);
      expect(runStore.saveStepExecution).toHaveBeenCalledWith(
        'run-1',
        expect.objectContaining({
          pendingData: expect.objectContaining({ name: 'orders', displayName: 'Orders' }),
        }),
      );
    });

    it('load-related-record: rejects empty selectedRecordId', async () => {
      const existing = {
        type: 'load-related-record' as const,
        stepIndex: 1,
        pendingData: {
          name: 'order',
          displayName: 'Order',
          selectedRecordId: [99],
          suggestedFields: [],
        },
        selectedRecordRef: { collectionName: 'customers', recordId: [42], stepIndex: 0 },
      };
      const runStore = createMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([existing]),
      });
      const server = createServer({ runStore });
      const token = signToken({ id: 'user-1' });

      const response = await request(server.callback)
        .patch('/runs/run-1/steps/1/pending-data')
        .set('Authorization', `Bearer ${token}`)
        .send({ userConfirmed: true, selectedRecordId: [] });

      expect(response.status).toBe(400);
      expect(response.body).toEqual(expect.objectContaining({ error: 'Invalid request body' }));
    });

    it('load-related-record: rejects relatedCollectionName (internal field)', async () => {
      const existing = {
        type: 'load-related-record' as const,
        stepIndex: 1,
        pendingData: {
          name: 'order',
          displayName: 'Order',
          selectedRecordId: [99],
          suggestedFields: [],
        },
        selectedRecordRef: { collectionName: 'customers', recordId: [42], stepIndex: 0 },
      };
      const runStore = createMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([existing]),
      });
      const server = createServer({ runStore });
      const token = signToken({ id: 'user-1' });

      const response = await request(server.callback)
        .patch('/runs/run-1/steps/1/pending-data')
        .set('Authorization', `Bearer ${token}`)
        .send({ userConfirmed: true, relatedCollectionName: 'Order' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual(expect.objectContaining({ error: 'Invalid request body' }));
    });

    it('trigger-action: rejects extra field', async () => {
      const existing = {
        type: 'trigger-action' as const,
        stepIndex: 0,
        pendingData: { name: 'send_email', displayName: 'Send Email' },
      };
      const runStore = createMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue([existing]),
      });
      const server = createServer({ runStore });
      const token = signToken({ id: 'user-1' });

      const response = await request(server.callback)
        .patch('/runs/run-1/steps/0/pending-data')
        .set('Authorization', `Bearer ${token}`)
        .send({ userConfirmed: true, name: 'other_action' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual(expect.objectContaining({ error: 'Invalid request body' }));
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
