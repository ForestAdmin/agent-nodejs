import ForestServerWorkflowPort from '../src/adapters/forest-server-workflow-port';
import { buildDatabaseExecutor, buildInMemoryExecutor } from '../src/build-workflow-executor';
import Runner from '../src/runner';
import SchemaCache from '../src/schema-cache';
import DatabaseStore from '../src/stores/database-store';
import InMemoryStore from '../src/stores/in-memory-store';

jest.mock('../src/runner');
jest.mock('../src/stores/in-memory-store');
jest.mock('../src/stores/database-store');
jest.mock('../src/adapters/agent-client-agent-port');
jest.mock('../src/adapters/forest-server-workflow-port');
jest.mock('../src/http/executor-http-server');
jest.mock('../src/adapters/ai-client-adapter');
jest.mock('@langchain/openai', () => ({ ChatOpenAI: jest.fn() }));
jest.mock('../src/adapters/server-ai-adapter');
jest.mock('sequelize', () => ({
  Sequelize: jest.fn(),
}));

const MockedRunner = Runner as jest.MockedClass<typeof Runner>;

const BASE_OPTIONS = {
  envSecret: 'a'.repeat(64),
  authSecret: 'test-secret',
  agentUrl: 'http://localhost:3310',
  httpPort: 3100,
  aiConfigurations: [
    { name: 'default', provider: 'openai' as const, model: 'gpt-4o', apiKey: 'sk-test' },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('buildInMemoryExecutor', () => {
  it('returns a WorkflowExecutor with start, stop, and state', () => {
    const executor = buildInMemoryExecutor(BASE_OPTIONS);

    expect(executor).toHaveProperty('start');
    expect(executor).toHaveProperty('stop');
    expect(executor).toHaveProperty('state');
  });

  it('creates an InMemoryStore as runStore', () => {
    buildInMemoryExecutor(BASE_OPTIONS);

    expect(InMemoryStore).toHaveBeenCalledTimes(1);
    expect(MockedRunner).toHaveBeenCalledWith(
      expect.objectContaining({ runStore: expect.any(InMemoryStore) }),
    );
  });

  it('creates ForestServerWorkflowPort with default forestServerUrl', () => {
    buildInMemoryExecutor(BASE_OPTIONS);

    expect(ForestServerWorkflowPort).toHaveBeenCalledWith(
      expect.objectContaining({
        envSecret: BASE_OPTIONS.envSecret,
        forestServerUrl: 'https://api.forestadmin.com',
      }),
    );
  });

  it('creates ForestServerWorkflowPort with custom forestServerUrl', () => {
    buildInMemoryExecutor({ ...BASE_OPTIONS, forestServerUrl: 'https://custom.example.com' });

    expect(ForestServerWorkflowPort).toHaveBeenCalledWith(
      expect.objectContaining({
        envSecret: BASE_OPTIONS.envSecret,
        forestServerUrl: 'https://custom.example.com',
      }),
    );
  });

  it('creates AgentClientAgentPort with agentUrl and authSecret as agentPort singleton', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const AgentClientAgentPort = require('../src/adapters/agent-client-agent-port').default;

    buildInMemoryExecutor(BASE_OPTIONS);

    expect(AgentClientAgentPort).toHaveBeenCalledWith({
      agentUrl: 'http://localhost:3310',
      authSecret: 'test-secret',
      schemaCache: expect.any(SchemaCache),
    });
  });

  it('passes an agentPort singleton to Runner', () => {
    buildInMemoryExecutor(BASE_OPTIONS);

    expect(MockedRunner).toHaveBeenCalledWith(
      expect.objectContaining({ agentPort: expect.any(Object) }),
    );
  });

  it('creates AiClientAdapter when aiConfigurations are provided', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const AiClientAdapter = require('../src/adapters/ai-client-adapter').default;

    buildInMemoryExecutor(BASE_OPTIONS);

    expect(AiClientAdapter).toHaveBeenCalledWith(BASE_OPTIONS.aiConfigurations);
  });

  it('creates ServerAiAdapter when aiConfigurations is not provided', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const ServerAiAdapter = require('../src/adapters/server-ai-adapter').default;

    const { aiConfigurations, ...optionsWithoutAi } = BASE_OPTIONS;
    buildInMemoryExecutor(optionsWithoutAi);

    expect(ServerAiAdapter).toHaveBeenCalledWith({
      forestServerUrl: 'https://api.forestadmin.com',
      envSecret: BASE_OPTIONS.envSecret,
    });
  });

  it('passes pollingIntervalMs with default value of 5000', () => {
    buildInMemoryExecutor(BASE_OPTIONS);

    expect(MockedRunner).toHaveBeenCalledWith(expect.objectContaining({ pollingIntervalMs: 5000 }));
  });

  it('passes custom pollingIntervalMs', () => {
    buildInMemoryExecutor({ ...BASE_OPTIONS, pollingIntervalMs: 1000 });

    expect(MockedRunner).toHaveBeenCalledWith(expect.objectContaining({ pollingIntervalMs: 1000 }));
  });

  it('applies a 5-minute default when stepTimeoutMs is not configured', () => {
    buildInMemoryExecutor(BASE_OPTIONS);

    expect(MockedRunner).toHaveBeenCalledWith(
      expect.objectContaining({ stepTimeoutMs: 5 * 60_000 }),
    );
  });

  it('respects a caller-provided stepTimeoutMs over the default', () => {
    buildInMemoryExecutor({ ...BASE_OPTIONS, stepTimeoutMs: 30_000 });

    expect(MockedRunner).toHaveBeenCalledWith(expect.objectContaining({ stepTimeoutMs: 30_000 }));
  });

  it('passes secrets to Runner config', () => {
    buildInMemoryExecutor(BASE_OPTIONS);

    expect(MockedRunner).toHaveBeenCalledWith(
      expect.objectContaining({
        envSecret: BASE_OPTIONS.envSecret,
        authSecret: BASE_OPTIONS.authSecret,
      }),
    );
  });

  it('does not pass httpPort to Runner (HTTP is composed externally)', () => {
    buildInMemoryExecutor({ ...BASE_OPTIONS, httpPort: 3000 });

    expect(MockedRunner).toHaveBeenCalledWith(expect.not.objectContaining({ httpPort: 3000 }));
  });
});

describe('buildDatabaseExecutor', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const { Sequelize: MockedSequelize } = require('sequelize');

  const DB_OPTIONS = {
    ...BASE_OPTIONS,
    database: { uri: 'postgres://localhost/mydb', dialect: 'postgres' as const },
  };

  it('returns a WorkflowExecutor with start, stop, and state', () => {
    const executor = buildDatabaseExecutor(DB_OPTIONS);

    expect(executor).toHaveProperty('start');
    expect(executor).toHaveProperty('stop');
    expect(executor).toHaveProperty('state');
  });

  it('creates a DatabaseStore as runStore', () => {
    buildDatabaseExecutor(DB_OPTIONS);

    expect(DatabaseStore).toHaveBeenCalledTimes(1);
    expect(MockedRunner).toHaveBeenCalledWith(
      expect.objectContaining({ runStore: expect.any(DatabaseStore) }),
    );
  });

  it('creates Sequelize with uri and passes remaining options through', () => {
    buildDatabaseExecutor(DB_OPTIONS);

    expect(MockedSequelize).toHaveBeenCalledWith('postgres://localhost/mydb', {
      dialect: 'postgres',
      logging: false,
    });
  });

  it('passes extra Sequelize options (logging, pool, ssl, etc.)', () => {
    buildDatabaseExecutor({
      ...BASE_OPTIONS,
      database: {
        uri: 'postgres://localhost/mydb',
        dialect: 'postgres',
        logging: false,
        pool: { max: 10, min: 2 },
      },
    });

    expect(MockedSequelize).toHaveBeenCalledWith('postgres://localhost/mydb', {
      dialect: 'postgres',
      logging: false,
      pool: { max: 10, min: 2 },
    });
  });

  it('forwards a caller-provided logging function to Sequelize', () => {
    const customLogger = jest.fn();
    buildDatabaseExecutor({
      ...BASE_OPTIONS,
      database: { uri: 'postgres://localhost/mydb', logging: customLogger },
    });

    expect(MockedSequelize).toHaveBeenCalledWith(
      'postgres://localhost/mydb',
      expect.objectContaining({ logging: customLogger }),
    );
  });

  it('keeps logging disabled when the caller passes logging: undefined', () => {
    buildDatabaseExecutor({
      ...BASE_OPTIONS,
      database: { uri: 'postgres://localhost/mydb', logging: undefined },
    });

    expect(MockedSequelize).toHaveBeenCalledWith(
      'postgres://localhost/mydb',
      expect.objectContaining({ logging: false }),
    );
  });

  it('creates Sequelize with options only when no uri is provided', () => {
    buildDatabaseExecutor({
      ...BASE_OPTIONS,
      database: { dialect: 'postgres', host: 'db.example.com', port: 5432, database: 'mydb' },
    });

    expect(MockedSequelize).toHaveBeenCalledWith({
      dialect: 'postgres',
      host: 'db.example.com',
      port: 5432,
      database: 'mydb',
      logging: false,
    });
  });

  it('shares the same common dependencies as buildInMemoryExecutor', () => {
    buildDatabaseExecutor(DB_OPTIONS);

    expect(ForestServerWorkflowPort).toHaveBeenCalledWith(
      expect.objectContaining({
        envSecret: BASE_OPTIONS.envSecret,
        forestServerUrl: 'https://api.forestadmin.com',
      }),
    );
    expect(MockedRunner).toHaveBeenCalledWith(
      expect.objectContaining({ agentPort: expect.any(Object) }),
    );
  });
});

// ---------------------------------------------------------------------------
// WorkflowExecutor composeur (start, stop, signal handlers, shutdown)
// ---------------------------------------------------------------------------

describe('WorkflowExecutor lifecycle', () => {
  let executor: ReturnType<typeof buildInMemoryExecutor>;
  let onSpy: jest.SpyInstance;
  let removeSpy: jest.SpyInstance;

  beforeEach(() => {
    // Setup Runner mock to have start/stop/state
    MockedRunner.prototype.start = jest.fn().mockResolvedValue(undefined);
    MockedRunner.prototype.stop = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(MockedRunner.prototype, 'state', {
      get: () => 'running',
      configurable: true,
    });

    onSpy = jest.spyOn(process, 'on');
    removeSpy = jest.spyOn(process, 'removeListener');

    executor = buildInMemoryExecutor(BASE_OPTIONS);
  });

  afterEach(() => {
    onSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('start() calls runner.start and server.start', async () => {
    await executor.start();

    expect(MockedRunner.prototype.start).toHaveBeenCalled();
  });

  it('start() registers SIGTERM and SIGINT handlers', async () => {
    await executor.start();

    expect(onSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
  });

  it('stop() removes signal handlers', async () => {
    await executor.start();
    await executor.stop();

    expect(removeSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
  });

  it('stop() calls runner.stop', async () => {
    await executor.start();
    await executor.stop();

    expect(MockedRunner.prototype.stop).toHaveBeenCalled();
  });

  it('concurrent stop() calls share the same promise', async () => {
    await executor.start();

    const [r1, r2] = await Promise.all([executor.stop(), executor.stop()]);

    expect(r1).toBeUndefined();
    expect(r2).toBeUndefined();
    // runner.stop is only called once (shared promise)
    expect(MockedRunner.prototype.stop).toHaveBeenCalledTimes(1);
  });

  it('stop() continues if HTTP server close fails', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const { default: MockedHttpServer } = require('../src/http/executor-http-server');
    MockedHttpServer.prototype.stop = jest.fn().mockRejectedValue(new Error('server error'));
    MockedHttpServer.prototype.start = jest.fn().mockResolvedValue(undefined);

    const exec = buildInMemoryExecutor(BASE_OPTIONS);
    await exec.start();
    await exec.stop();

    // runner.stop still called despite server.stop failure
    expect(MockedRunner.prototype.stop).toHaveBeenCalled();
  });

  it('state getter returns runner state', () => {
    expect(executor.state).toBe('running');
  });

  it('SIGTERM handler calls shutdown and sets exitCode=0 on success', async () => {
    jest.useFakeTimers();
    const originalExitCode = process.exitCode;
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    try {
      await executor.start();

      const sigtermCall = onSpy.mock.calls.find(([sig]) => sig === 'SIGTERM');
      if (!sigtermCall) throw new Error('SIGTERM handler not registered');
      const handler = sigtermCall[1] as () => Promise<void>;

      await handler();

      expect(process.exitCode).toBe(0);
      expect(MockedRunner.prototype.stop).toHaveBeenCalled();

      // Verify safety-net timer is scheduled and triggers process.exit when fired
      jest.runAllTimers();
      expect(exitSpy).toHaveBeenCalledWith(0);
    } finally {
      process.exitCode = originalExitCode;
      exitSpy.mockRestore();
      jest.useRealTimers();
    }
  });

  it('SIGTERM handler sets exitCode=1 when shutdown throws', async () => {
    jest.useFakeTimers();
    const originalExitCode = process.exitCode;
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    MockedRunner.prototype.stop = jest.fn().mockRejectedValue(new Error('stop failed'));

    try {
      const exec = buildInMemoryExecutor(BASE_OPTIONS);
      await exec.start();

      const sigtermCall = onSpy.mock.calls.find(([sig]) => sig === 'SIGTERM');
      if (!sigtermCall) throw new Error('SIGTERM handler not registered');
      const handler = sigtermCall[1] as () => Promise<void>;

      await handler();

      expect(process.exitCode).toBe(1);

      jest.runAllTimers();
      expect(exitSpy).toHaveBeenCalledWith(1);
    } finally {
      process.exitCode = originalExitCode;
      exitSpy.mockRestore();
      jest.useRealTimers();
    }
  });
});
