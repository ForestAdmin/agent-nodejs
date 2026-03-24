import type { RunStore } from '../../src/ports/run-store';
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

function createServer(overrides: { runStore?: RunStore; runner?: Runner } = {}) {
  return new ExecutorHttpServer({
    port: 0,
    runStore: overrides.runStore ?? createMockRunStore(),
    runner: overrides.runner ?? createMockRunner(),
    authSecret: AUTH_SECRET,
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
