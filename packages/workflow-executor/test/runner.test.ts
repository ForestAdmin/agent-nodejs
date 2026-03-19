import type { AgentPort } from '../src/ports/agent-port';
import type { WorkflowPort } from '../src/ports/workflow-port';
import type { RunStoreFactory } from '../src/run-store-factory';

import ExecutorHttpServer from '../src/http/executor-http-server';
import Runner from '../src/runner';

jest.mock('../src/http/executor-http-server');

const MockedExecutorHttpServer = ExecutorHttpServer as jest.MockedClass<typeof ExecutorHttpServer>;

function createRunnerConfig(overrides: { httpPort?: number } = {}) {
  return {
    agentPort: {} as AgentPort,
    workflowPort: {} as WorkflowPort,
    runStoreFactory: { buildRunStore: jest.fn() } as unknown as RunStoreFactory,
    pollingIntervalMs: 2000,
    ...overrides,
  };
}

describe('Runner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MockedExecutorHttpServer.prototype.start = jest.fn().mockResolvedValue(undefined);
    MockedExecutorHttpServer.prototype.stop = jest.fn().mockResolvedValue(undefined);
  });

  describe('start', () => {
    it('should start the HTTP server when httpPort is configured', async () => {
      const config = createRunnerConfig({ httpPort: 3100 });
      const runner = new Runner(config);

      await runner.start();

      expect(MockedExecutorHttpServer).toHaveBeenCalledWith({
        port: 3100,
        runStoreFactory: config.runStoreFactory,
        runner,
      });
      expect(MockedExecutorHttpServer.prototype.start).toHaveBeenCalled();
    });

    it('should not start the HTTP server when httpPort is not configured', async () => {
      const runner = new Runner(createRunnerConfig());

      await runner.start();

      expect(MockedExecutorHttpServer).not.toHaveBeenCalled();
    });

    it('should not create a second HTTP server if already started', async () => {
      const runner = new Runner(createRunnerConfig({ httpPort: 3100 }));

      await runner.start();
      await runner.start();

      expect(MockedExecutorHttpServer).toHaveBeenCalledTimes(1);
    });
  });

  describe('stop', () => {
    it('should stop the HTTP server when running', async () => {
      const runner = new Runner(createRunnerConfig({ httpPort: 3100 }));

      await runner.start();
      await runner.stop();

      expect(MockedExecutorHttpServer.prototype.stop).toHaveBeenCalled();
    });

    it('should handle stop when no HTTP server is running', async () => {
      const runner = new Runner(createRunnerConfig());

      await expect(runner.stop()).resolves.toBeUndefined();
    });

    it('should allow restarting after stop', async () => {
      const runner = new Runner(createRunnerConfig({ httpPort: 3100 }));

      await runner.start();
      await runner.stop();
      await runner.start();

      expect(MockedExecutorHttpServer).toHaveBeenCalledTimes(2);
    });
  });

  describe('triggerPoll', () => {
    it('should resolve without error', async () => {
      const runner = new Runner(createRunnerConfig());

      await expect(runner.triggerPoll('run-1')).resolves.toBeUndefined();
    });
  });
});
