import type { RunStore } from '../../src/ports/run-store';
import type Runner from '../../src/runner';

import request from 'supertest';

import ExecutorHttpServer from '../../src/http/executor-http-server';

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

describe('ExecutorHttpServer', () => {
  describe('GET /runs/:runId', () => {
    it('should return steps from the run store', async () => {
      const steps = [{ type: 'condition' as const, stepIndex: 0 }];

      const runStore = createMockRunStore({
        getStepExecutions: jest.fn().mockResolvedValue(steps),
      });

      const server = new ExecutorHttpServer({
        port: 0,
        runStore,
        runner: createMockRunner(),
      });

      const response = await request(server.callback).get('/runs/run-1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ steps });
      expect(runStore.getStepExecutions).toHaveBeenCalledWith('run-1');
    });

    it('should return 500 when getStepExecutions rejects', async () => {
      const runStore = createMockRunStore({
        getStepExecutions: jest.fn().mockRejectedValue(new Error('db error')),
      });

      const server = new ExecutorHttpServer({
        port: 0,
        runStore,
        runner: createMockRunner(),
      });

      const response = await request(server.callback).get('/runs/run-1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'db error' });
    });
  });

  describe('POST /runs/:runId/trigger', () => {
    it('should call runner.triggerPoll with the runId', async () => {
      const runner = createMockRunner();

      const server = new ExecutorHttpServer({
        port: 0,
        runStore: createMockRunStore(),
        runner,
      });

      const response = await request(server.callback).post('/runs/run-1/trigger');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ triggered: true });
      expect(runner.triggerPoll).toHaveBeenCalledWith('run-1');
    });

    it('should propagate errors from runner', async () => {
      const runner = createMockRunner({
        triggerPoll: jest.fn().mockRejectedValue(new Error('poll failed')),
      });

      const server = new ExecutorHttpServer({
        port: 0,
        runStore: createMockRunStore(),
        runner,
      });

      const response = await request(server.callback).post('/runs/run-1/trigger');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'poll failed' });
    });
  });

  describe('start / stop', () => {
    it('should start and stop the server', async () => {
      const server = new ExecutorHttpServer({
        port: 0,
        runStore: createMockRunStore(),
        runner: createMockRunner(),
      });

      await server.start();
      await expect(server.stop()).resolves.toBeUndefined();
    });

    it('should handle stop when not started', async () => {
      const server = new ExecutorHttpServer({
        port: 0,
        runStore: createMockRunStore(),
        runner: createMockRunner(),
      });

      await expect(server.stop()).resolves.toBeUndefined();
    });
  });
});
