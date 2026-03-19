import type { RunStore } from '../../src/ports/run-store';
import type WorkflowRunner from '../../src/runner';

import request from 'supertest';

import ExecutorHttpServer from '../../src/http/executor-http-server';

function createMockRunStore(overrides: Partial<RunStore> = {}): RunStore {
  return {
    getStepExecutions: jest.fn().mockResolvedValue([]),
    saveStepExecution: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createMockWorkflowRunner(overrides: Partial<WorkflowRunner> = {}): WorkflowRunner {
  return {
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    triggerPoll: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as WorkflowRunner;
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
        runStoreFactory: { buildRunStore: () => runStore },
        workflowRunner: createMockWorkflowRunner(),
      });

      const response = await request(server.callback).get('/runs/run-1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ steps });
    });

    it('should return 404 when run is not found', async () => {
      const server = new ExecutorHttpServer({
        port: 0,
        runStoreFactory: { buildRunStore: () => null },
        workflowRunner: createMockWorkflowRunner(),
      });

      const response = await request(server.callback).get('/runs/unknown');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('unknown');
    });
  });

  describe('POST /runs/:runId/trigger', () => {
    it('should call workflowRunner.triggerPoll with the runId', async () => {
      const workflowRunner = createMockWorkflowRunner();

      const server = new ExecutorHttpServer({
        port: 0,
        runStoreFactory: { buildRunStore: () => null },
        workflowRunner,
      });

      const response = await request(server.callback).post('/runs/run-1/trigger');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ triggered: true });
      expect(workflowRunner.triggerPoll).toHaveBeenCalledWith('run-1');
    });

    it('should propagate errors from workflowRunner', async () => {
      const workflowRunner = createMockWorkflowRunner({
        triggerPoll: jest.fn().mockRejectedValue(new Error('poll failed')),
      });

      const server = new ExecutorHttpServer({
        port: 0,
        runStoreFactory: { buildRunStore: () => null },
        workflowRunner,
      });

      const response = await request(server.callback).post('/runs/run-1/trigger');

      expect(response.status).toBe(500);
    });
  });

  describe('start / stop', () => {
    it('should start and stop the server', async () => {
      const server = new ExecutorHttpServer({
        port: 0,
        runStoreFactory: { buildRunStore: () => null },
        workflowRunner: createMockWorkflowRunner(),
      });

      await server.start();
      await expect(server.stop()).resolves.toBeUndefined();
    });

    it('should handle stop when not started', async () => {
      const server = new ExecutorHttpServer({
        port: 0,
        runStoreFactory: { buildRunStore: () => null },
        workflowRunner: createMockWorkflowRunner(),
      });

      await expect(server.stop()).resolves.toBeUndefined();
    });
  });
});
