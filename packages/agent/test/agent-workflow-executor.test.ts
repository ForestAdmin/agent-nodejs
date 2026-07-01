/* eslint-disable @typescript-eslint/no-explicit-any */

import { DataSourceCustomizer } from '@forestadmin/datasource-customizer';

import * as factories from './__factories__';
import Agent from '../src/agent';

// Mock routes so start() doesn't need a real datasource HTTP stack.
const mockSetupRoute = jest.fn();
const mockBootstrap = jest.fn();
const mockMakeRoutes = jest.fn();

jest.mock('../src/routes', () => ({
  __esModule: true,
  default: (...args) => mockMakeRoutes(...args),
}));

jest.mock('@forestadmin/datasource-customizer');

// Mock the optional executor package: start()/stop() are observable, no real DB or HTTP server.
const mockExecutorStart = jest.fn();
const mockExecutorStop = jest.fn();
const mockBuildDatabaseExecutor = jest.fn();

jest.mock('@forestadmin/workflow-executor', () => ({
  __esModule: true,
  buildDatabaseExecutor: (options: unknown) => mockBuildDatabaseExecutor(options),
}));

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.DATABASE_URL;
  delete process.env.HTTP_PORT;

  mockMakeRoutes.mockReturnValue([{ setupRoutes: mockSetupRoute, bootstrap: mockBootstrap }]);
  mockBuildDatabaseExecutor.mockReturnValue({
    start: mockExecutorStart,
    stop: mockExecutorStop,
    state: 'idle',
  });
  jest
    .mocked(DataSourceCustomizer.prototype.getDataSource)
    .mockResolvedValue(factories.dataSource.build());
});

describe('Agent.addWorkflowExecutor', () => {
  const buildOptions = (overrides: Record<string, unknown> = {}) =>
    factories.forestAdminHttpDriverOptions.build({ skipSchemaUpdate: true, ...overrides });

  describe('configuration (synchronous)', () => {
    test('wires the proxy to the default loopback port 3400', () => {
      const agent = new Agent(buildOptions());

      agent.addWorkflowExecutor();

      expect((agent as any).options.workflowExecutorUrl).toBe('http://127.0.0.1:3400');
    });

    test('honors an explicit port', () => {
      const agent = new Agent(buildOptions());

      agent.addWorkflowExecutor({ port: 5005 });

      expect((agent as any).options.workflowExecutorUrl).toBe('http://127.0.0.1:5005');
    });

    test('falls back to the HTTP_PORT environment variable', () => {
      process.env.HTTP_PORT = '4567';
      const agent = new Agent(buildOptions());

      agent.addWorkflowExecutor();

      expect((agent as any).options.workflowExecutorUrl).toBe('http://127.0.0.1:4567');
    });

    test('returns the agent for chaining', () => {
      const agent = new Agent(buildOptions());

      expect(agent.addWorkflowExecutor()).toBe(agent);
    });

    test('throws when called more than once', () => {
      const agent = new Agent(buildOptions());
      agent.addWorkflowExecutor();

      expect(() => agent.addWorkflowExecutor()).toThrow(
        'addWorkflowExecutor can only be called once.',
      );
    });

    test('throws when the workflowExecutorUrl option is already set (remote executor)', () => {
      const agent = new Agent(buildOptions({ workflowExecutorUrl: 'http://remote:4001' }));

      expect(() => agent.addWorkflowExecutor()).toThrow(
        'Cannot use addWorkflowExecutor together with the workflowExecutorUrl option',
      );
    });
  });

  describe('boot on start()', () => {
    test('builds the executor with the agent secrets, provided agentUrl, port and database', async () => {
      const options = buildOptions();
      const agent = new Agent(options);
      agent.addWorkflowExecutor({
        agentUrl: 'http://my-agent/prefix',
        database: { uri: 'postgres://localhost/db' },
        port: 4400,
      });

      await agent.start();

      expect(mockBuildDatabaseExecutor).toHaveBeenCalledWith(
        expect.objectContaining({
          envSecret: options.envSecret,
          authSecret: options.authSecret,
          forestServerUrl: options.forestServerUrl,
          agentUrl: 'http://my-agent/prefix',
          httpPort: 4400,
          database: { uri: 'postgres://localhost/db' },
          // Embedded: the host process keeps control of SIGTERM/SIGINT and its own exit.
          manageProcessSignals: false,
        }),
      );
      expect(mockExecutorStart).toHaveBeenCalledTimes(1);
    });

    test('fails the agent start when the embedded executor fails to start', async () => {
      // No graceful degradation: a failing executor (e.g. failed agent probe / unreachable DB)
      // must crash agent.start() rather than leave the agent serving a dead executor.
      mockExecutorStart.mockRejectedValueOnce(new Error('agent probe failed'));
      const agent = new Agent(buildOptions());
      agent.addWorkflowExecutor({
        agentUrl: 'http://my-agent',
        database: { uri: 'postgres://localhost/db' },
      });

      await expect(agent.start()).rejects.toThrow('agent probe failed');
    });

    test('forwards executor logs through the agent logger with a prefix', async () => {
      const logger = jest.fn();
      mockBuildDatabaseExecutor.mockImplementation((opts: any) => {
        opts.logger('Warn', 'something happened');

        return { start: mockExecutorStart, stop: mockExecutorStop, state: 'idle' };
      });
      const agent = new Agent(buildOptions({ logger }));
      agent.addWorkflowExecutor({
        agentUrl: 'http://my-agent',
        database: { uri: 'postgres://localhost/db' },
      });

      await agent.start();

      expect(logger).toHaveBeenCalledWith('Warn', '[workflow-executor] something happened');
    });

    test('forwards the executor structured log context onto the message', async () => {
      const logger = jest.fn();
      mockBuildDatabaseExecutor.mockImplementation((opts: any) => {
        opts.logger('Error', 'step failed', { runId: 'run-1', error: 'boom' });

        return { start: mockExecutorStart, stop: mockExecutorStop, state: 'idle' };
      });
      const agent = new Agent(buildOptions({ logger }));
      agent.addWorkflowExecutor({
        agentUrl: 'http://my-agent',
        database: { uri: 'postgres://localhost/db' },
      });

      await agent.start();

      // The agent logger only takes an Error as 3rd arg, so the context must survive in the
      // message rather than being dropped.
      expect(logger).toHaveBeenCalledWith(
        'Error',
        '[workflow-executor] step failed {"runId":"run-1","error":"boom"}',
      );
    });

    test('falls back to the DATABASE_URL environment variable when no database is provided', async () => {
      process.env.DATABASE_URL = 'postgres://env-host/env-db';
      const agent = new Agent(buildOptions());
      agent.addWorkflowExecutor({ agentUrl: 'http://my-agent' });

      await agent.start();

      expect(mockBuildDatabaseExecutor).toHaveBeenCalledWith(
        expect.objectContaining({ database: { uri: 'postgres://env-host/env-db' } }),
      );
    });

    test('derives the agentUrl from the standalone server port and prefix', async () => {
      const agent = new Agent(buildOptions());
      agent.addWorkflowExecutor({ database: { uri: 'postgres://localhost/db' } });
      agent.mountOnStandaloneServer(0);

      await agent.start();

      expect(mockBuildDatabaseExecutor).toHaveBeenCalledWith(
        expect.objectContaining({
          agentUrl: `http://127.0.0.1:${agent.standaloneServerPort}/prefix`,
        }),
      );

      await agent.stop();
    });

    test('derives the agentUrl using the standalone server host when one is provided', async () => {
      const agent = new Agent(buildOptions());
      agent.addWorkflowExecutor({ database: { uri: 'postgres://localhost/db' } });
      // A specific bind host must be used verbatim, not replaced by a hard-coded 127.0.0.1.
      agent.mountOnStandaloneServer(0, 'localhost');

      await agent.start();

      expect(mockBuildDatabaseExecutor).toHaveBeenCalledWith(
        expect.objectContaining({
          agentUrl: `http://localhost:${agent.standaloneServerPort}/prefix`,
        }),
      );

      await agent.stop();
    });

    test('maps a wildcard standalone host to loopback for the agentUrl', async () => {
      const agent = new Agent(buildOptions());
      agent.addWorkflowExecutor({ database: { uri: 'postgres://localhost/db' } });
      // 0.0.0.0 is a bind wildcard, not a connectable address → the executor must use loopback.
      agent.mountOnStandaloneServer(0, '0.0.0.0');

      await agent.start();

      expect(mockBuildDatabaseExecutor).toHaveBeenCalledWith(
        expect.objectContaining({
          agentUrl: `http://127.0.0.1:${agent.standaloneServerPort}/prefix`,
        }),
      );

      await agent.stop();
    });

    test('throws when no database is configured', async () => {
      const agent = new Agent(buildOptions());
      agent.addWorkflowExecutor({ agentUrl: 'http://my-agent' });

      await expect(agent.start()).rejects.toThrow(
        'Embedded workflow executor requires a database to persist run state',
      );
      expect(mockBuildDatabaseExecutor).not.toHaveBeenCalled();
    });

    test('throws when the agentUrl cannot be derived (not standalone) and is not provided', async () => {
      const agent = new Agent(buildOptions());
      agent.addWorkflowExecutor({ database: { uri: 'postgres://localhost/db' } });

      await expect(agent.start()).rejects.toThrow('unable to derive the agent URL');
      expect(mockBuildDatabaseExecutor).not.toHaveBeenCalled();
    });

    test('does not build an executor when addWorkflowExecutor was not called', async () => {
      const agent = new Agent(buildOptions());

      await agent.start();

      expect(mockBuildDatabaseExecutor).not.toHaveBeenCalled();
    });
  });

  describe('stop()', () => {
    test('stops the embedded executor', async () => {
      const agent = new Agent(buildOptions());
      agent.addWorkflowExecutor({
        agentUrl: 'http://my-agent',
        database: { uri: 'postgres://localhost/db' },
      });
      await agent.start();

      await agent.stop();

      expect(mockExecutorStop).toHaveBeenCalledTimes(1);
    });
  });
});
